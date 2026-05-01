-- 1) Add prazo_resposta to cotacoes
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS prazo_resposta timestamptz NULL;

-- 2) Add visualizado_em to cotacao_fornecedores
ALTER TABLE public.cotacao_fornecedores
  ADD COLUMN IF NOT EXISTS visualizado_em timestamptz NULL;

-- 3) Realtime
ALTER TABLE public.cotacoes REPLICA IDENTITY FULL;
ALTER TABLE public.cotacao_fornecedores REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacao_fornecedores;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- 4) Update RPC to return prazo_resposta
DROP FUNCTION IF EXISTS public.get_cotacao_status_for_supplier(text, uuid);

CREATE OR REPLACE FUNCTION public.get_cotacao_status_for_supplier(_token text, _loja_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(cotacao_id uuid, status text, loja_id uuid, loja_nome text, prazo_resposta timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supplier_id uuid;
BEGIN
  SELECT id INTO _supplier_id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT c.id, c.status::text, c.loja_id, l.nome, c.prazo_resposta
  FROM public.cotacoes c
  JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = c.id
  LEFT JOIN public.lojas l ON l.id = c.loja_id
  WHERE cf.fornecedor_id = _supplier_id
    AND (_loja_id IS NULL OR c.loja_id = _loja_id)
  ORDER BY 
    CASE WHEN c.status = 'ativa' THEN 0 ELSE 1 END,
    c.created_at DESC
  LIMIT 1;
END;
$function$;

-- 5) RPC to mark visualization (idempotent, callable by anon)
CREATE OR REPLACE FUNCTION public.marcar_cotacao_visualizada(_token text, _cotacao_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supplier_id uuid;
BEGIN
  SELECT id INTO _supplier_id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN false; END IF;

  UPDATE public.cotacao_fornecedores
  SET visualizado_em = now()
  WHERE cotacao_id = _cotacao_id
    AND fornecedor_id = _supplier_id
    AND visualizado_em IS NULL;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.marcar_cotacao_visualizada(text, uuid) TO anon, authenticated;