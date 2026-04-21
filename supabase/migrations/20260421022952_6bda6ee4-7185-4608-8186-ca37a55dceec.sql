CREATE OR REPLACE FUNCTION public.admin_list_clientes()
RETURNS TABLE(
  user_id uuid,
  email text,
  created_at timestamp with time zone,
  loja_principal text,
  cnpj text,
  total_lojas bigint,
  total_produtos bigint,
  total_produtos_inativos bigint,
  total_fornecedores bigint,
  total_cotacoes bigint,
  total_pedidos bigint,
  plan_name text,
  plan_status text,
  trial_end timestamp with time zone,
  ultima_cotacao_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    (SELECT l.nome FROM public.lojas l
       WHERE l.user_id = u.id
       ORDER BY l.created_at ASC LIMIT 1) AS loja_principal,
    (SELECT l.cnpj FROM public.lojas l
       WHERE l.user_id = u.id AND l.cnpj IS NOT NULL
       ORDER BY l.created_at ASC LIMIT 1) AS cnpj,
    (SELECT COUNT(*) FROM public.lojas l
       WHERE l.user_id = u.id) AS total_lojas,
    (SELECT COUNT(*) FROM public.produtos p
       WHERE p.user_id = u.id AND p.ativo = true) AS total_produtos,
    (SELECT COUNT(*) FROM public.produtos p
       WHERE p.user_id = u.id AND p.ativo = false) AS total_produtos_inativos,
    (SELECT COUNT(*) FROM public.fornecedores f
       WHERE f.user_id = u.id) AS total_fornecedores,
    (SELECT COUNT(*) FROM public.cotacoes c
       WHERE c.created_by = u.id) AS total_cotacoes,
    (SELECT COUNT(*) FROM public.pedidos pe
       WHERE pe.created_by = u.id) AS total_pedidos,
    COALESCE(
      (SELECT p.name FROM public.subscriptions s
         JOIN public.plans p ON p.id = s.plan_id
         WHERE s.user_id = u.id
           AND s.status IN ('active','trialing')
           AND (s.current_period_end IS NULL OR s.current_period_end > now())
         ORDER BY s.created_at DESC LIMIT 1),
      'free'
    ) AS plan_name,
    COALESCE(
      (SELECT s.status::text FROM public.subscriptions s
         WHERE s.user_id = u.id
           AND s.status IN ('active','trialing')
           AND (s.current_period_end IS NULL OR s.current_period_end > now())
         ORDER BY s.created_at DESC LIMIT 1),
      'none'
    ) AS plan_status,
    (SELECT s.current_period_end FROM public.subscriptions s
       WHERE s.user_id = u.id
         AND s.status = 'trialing'
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
       ORDER BY s.created_at DESC LIMIT 1) AS trial_end,
    (SELECT MAX(c.created_at) FROM public.cotacoes c
       WHERE c.created_by = u.id) AS ultima_cotacao_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;