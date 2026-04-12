
-- 1. Fix search_path on email queue functions
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

-- 2. Create helper function so conferencia policies don't need direct pedidos access
CREATE OR REPLACE FUNCTION public.pedido_is_enviado(_pedido_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos WHERE id = _pedido_id AND status = 'enviado'::pedido_status
  )
$$;

-- Also create a function to check pedido owner
CREATE OR REPLACE FUNCTION public.pedido_owner(_pedido_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT created_by FROM public.pedidos WHERE id = _pedido_id LIMIT 1
$$;

-- 3. Replace anon conferencias policies to use helper functions
DROP POLICY IF EXISTS "Anon insert conferencias" ON public.conferencias;
CREATE POLICY "Anon insert conferencias" ON public.conferencias
  FOR INSERT TO anon
  WITH CHECK (pedido_is_enviado(pedido_id));

DROP POLICY IF EXISTS "Anon read conferencias scoped" ON public.conferencias;
CREATE POLICY "Anon read conferencias scoped" ON public.conferencias
  FOR SELECT TO anon
  USING (pedido_is_enviado(pedido_id));

-- 4. Replace anon conferencia_itens policies to use helper functions
DROP POLICY IF EXISTS "Anon insert conferencia_itens" ON public.conferencia_itens;
CREATE POLICY "Anon insert conferencia_itens" ON public.conferencia_itens
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM conferencias conf
    WHERE conf.id = conferencia_itens.conferencia_id
      AND pedido_is_enviado(conf.pedido_id)
  ));

DROP POLICY IF EXISTS "Anon read conferencia_itens scoped" ON public.conferencia_itens;
CREATE POLICY "Anon read conferencia_itens scoped" ON public.conferencia_itens
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM conferencias conf
    WHERE conf.id = conferencia_itens.conferencia_id
      AND pedido_is_enviado(conf.pedido_id)
  ));

-- 5. Drop the broad anon pedidos policy
DROP POLICY IF EXISTS "Anon read pedidos enviados" ON public.pedidos;
