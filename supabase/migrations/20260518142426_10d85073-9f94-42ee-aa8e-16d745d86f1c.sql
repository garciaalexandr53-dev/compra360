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