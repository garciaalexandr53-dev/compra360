CREATE OR REPLACE FUNCTION public.admin_get_cliente_detalhes(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'last_sign_in_at', (SELECT u.last_sign_in_at FROM auth.users u WHERE u.id = _user_id),
    'telefone', (SELECT pr.whatsapp FROM public.profiles pr WHERE pr.user_id = _user_id LIMIT 1),
    'subscription_started_at', (
      SELECT s.current_period_start FROM public.subscriptions s
       WHERE s.user_id = _user_id AND s.status IN ('active','trialing')
       ORDER BY s.created_at DESC LIMIT 1
    ),
    'current_period_end', (
      SELECT s.current_period_end FROM public.subscriptions s
       WHERE s.user_id = _user_id
       ORDER BY s.created_at DESC LIMIT 1
    ),
    'subscription_created_at', (
      SELECT s.created_at FROM public.subscriptions s
       WHERE s.user_id = _user_id
       ORDER BY s.created_at ASC LIMIT 1
    ),
    'plan_price_monthly', (
      SELECT p.price_monthly FROM public.subscriptions s
       JOIN public.plans p ON p.id = s.plan_id
       WHERE s.user_id = _user_id AND s.status IN ('active','trialing')
       ORDER BY s.created_at DESC LIMIT 1
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

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

  -- Nunca encurtar um período já pago
  _fim := GREATEST(_fim, _inicio);

  IF _fim <= now() THEN
    RAISE EXCEPTION 'Vencimento deve ser no futuro';
  END IF;

  IF _sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan_id, status, origem, ciclo, metodo_pagamento, valor_pago, observacao,
      current_period_start, current_period_end
    ) VALUES (
      _user_id, _plan_id, 'active', 'manual', _ciclo, _metodo, _valor, _observacao,
      now(), _fim
    ) RETURNING id INTO _sub_id;
  ELSE
    UPDATE public.subscriptions SET
      plan_id = _plan_id,
      status = 'active',
      origem = 'manual',
      ciclo = _ciclo,
      metodo_pagamento = _metodo,
      valor_pago = _valor,
      observacao = _observacao,
      current_period_start = now(),
      current_period_end = _fim,
      canceled_at = NULL,
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

  RETURN jsonb_build_object('subscription_id', _sub_id, 'periodo_fim', _fim);
END;
$function$;