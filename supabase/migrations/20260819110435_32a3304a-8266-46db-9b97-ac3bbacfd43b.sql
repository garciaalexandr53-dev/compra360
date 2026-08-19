-- 1. Colunas de assinatura manual
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS ciclo text,
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS valor_pago numeric,
  ADD COLUMN IF NOT EXISTS observacao text;

-- 2. Histórico de pagamentos manuais
CREATE TABLE IF NOT EXISTS public.pagamentos_manuais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  valor numeric,
  metodo text NOT NULL,
  ciclo text NOT NULL,
  periodo_inicio timestamp with time zone NOT NULL,
  periodo_fim timestamp with time zone NOT NULL,
  observacao text,
  registrado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pagamentos_manuais TO authenticated;
GRANT ALL ON public.pagamentos_manuais TO service_role;

ALTER TABLE public.pagamentos_manuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver pagamentos manuais" ON public.pagamentos_manuais;
CREATE POLICY "Admins podem ver pagamentos manuais"
  ON public.pagamentos_manuais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_pagamentos_manuais_user ON public.pagamentos_manuais(user_id, created_at DESC);

-- 3. RPC: registrar pagamento manual
CREATE OR REPLACE FUNCTION public.admin_registrar_pagamento_manual(
  _user_id uuid,
  _plan_name text,
  _ciclo text,
  _vencimento timestamp with time zone DEFAULT NULL,
  _metodo text DEFAULT 'pix',
  _valor numeric DEFAULT NULL,
  _observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _plan_id uuid;
  _sub_id uuid;
  _inicio timestamptz;
  _fim timestamptz;
  _atual timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _ciclo NOT IN ('mensal','anual') THEN
    RAISE EXCEPTION 'Ciclo inválido: %', _ciclo;
  END IF;

  IF _metodo NOT IN ('pix','transferencia','dinheiro','boleto','outro') THEN
    RAISE EXCEPTION 'Método inválido: %', _metodo;
  END IF;

  SELECT id INTO _plan_id FROM public.plans WHERE name = _plan_name LIMIT 1;
  IF _plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', _plan_name;
  END IF;

  SELECT id, current_period_end INTO _sub_id, _atual
  FROM public.subscriptions
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Renovação encadeia a partir do vencimento atual (não perde dias)
  _inicio := GREATEST(now(), COALESCE(_atual, now()));
  IF _atual IS NULL OR _atual < now() THEN
    _inicio := now();
  END IF;

  _fim := COALESCE(
    _vencimento,
    CASE WHEN _ciclo = 'anual' THEN _inicio + interval '12 months' ELSE _inicio + interval '30 days' END
  );

  IF _fim <= now() THEN
    RAISE EXCEPTION 'Vencimento deve ser no futuro';
  END IF;

  IF _sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan_id, status, current_period_start, current_period_end,
      origem, ciclo, metodo_pagamento, valor_pago, observacao
    ) VALUES (
      _user_id, _plan_id, 'active', _inicio, _fim,
      'manual', _ciclo, _metodo, _valor, _observacao
    ) RETURNING id INTO _sub_id;
  ELSE
    UPDATE public.subscriptions
    SET plan_id = _plan_id,
        status = 'active',
        current_period_start = _inicio,
        current_period_end = _fim,
        canceled_at = NULL,
        origem = 'manual',
        ciclo = _ciclo,
        metodo_pagamento = _metodo,
        valor_pago = _valor,
        observacao = _observacao,
        updated_at = now()
    WHERE id = _sub_id;
  END IF;

  INSERT INTO public.pagamentos_manuais (
    user_id, subscription_id, plan_id, valor, metodo, ciclo,
    periodo_inicio, periodo_fim, observacao, registrado_por
  ) VALUES (
    _user_id, _sub_id, _plan_id, _valor, _metodo, _ciclo,
    _inicio, _fim, _observacao, auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan', _plan_name,
    'ciclo', _ciclo,
    'periodo_inicio', _inicio,
    'periodo_fim', _fim
  );
END;
$function$;

-- 4. RPC: listar pagamentos manuais de um cliente
CREATE OR REPLACE FUNCTION public.admin_list_pagamentos_manuais(_user_id uuid)
RETURNS TABLE(
  id uuid, valor numeric, metodo text, ciclo text,
  periodo_inicio timestamp with time zone, periodo_fim timestamp with time zone,
  observacao text, plan_name text, created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
    SELECT pm.id, pm.valor, pm.metodo, pm.ciclo, pm.periodo_inicio, pm.periodo_fim,
           pm.observacao, p.name::text, pm.created_at
    FROM public.pagamentos_manuais pm
    JOIN public.plans p ON p.id = pm.plan_id
    WHERE pm.user_id = _user_id
    ORDER BY pm.created_at DESC;
END;
$function$;

-- 5. RPC: assinaturas manuais e vencimentos
CREATE OR REPLACE FUNCTION public.admin_list_assinaturas_manuais()
RETURNS TABLE(
  user_id uuid, email text, whatsapp text, plan_name text, ciclo text,
  metodo_pagamento text, valor_pago numeric, status text,
  current_period_end timestamp with time zone, dias_restantes integer,
  ultimo_pagamento_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
    SELECT
      s.user_id,
      u.email::text,
      (SELECT pr.whatsapp FROM public.profiles pr WHERE pr.user_id = s.user_id LIMIT 1),
      p.name::text,
      s.ciclo,
      s.metodo_pagamento,
      s.valor_pago,
      s.status::text,
      s.current_period_end,
      CASE WHEN s.current_period_end IS NULL THEN NULL
           ELSE FLOOR(EXTRACT(epoch FROM (s.current_period_end - now())) / 86400)::int
      END,
      (SELECT MAX(pm.created_at) FROM public.pagamentos_manuais pm WHERE pm.user_id = s.user_id)
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    LEFT JOIN auth.users u ON u.id = s.user_id
    WHERE s.origem = 'manual'
    ORDER BY s.current_period_end ASC NULLS LAST;
END;
$function$;