DROP FUNCTION IF EXISTS public.admin_list_clientes();

CREATE OR REPLACE FUNCTION public.admin_list_clientes()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, loja_principal text, cnpj text, total_lojas bigint, total_produtos bigint, total_produtos_inativos bigint, total_fornecedores bigint, total_cotacoes bigint, total_pedidos bigint, plan_name text, plan_status text, trial_end timestamp with time zone, ultima_cotacao_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    u.email::TEXT,
    u.created_at,
    (SELECT l.nome FROM public.lojas l WHERE l.user_id = u.id ORDER BY l.created_at LIMIT 1) AS loja_principal,
    (SELECT l.cnpj FROM public.lojas l WHERE l.user_id = u.id AND l.cnpj IS NOT NULL ORDER BY l.created_at LIMIT 1) AS cnpj,
    (SELECT COUNT(*) FROM public.lojas l WHERE l.user_id = u.id) AS total_lojas,
    (SELECT COUNT(*) FROM public.produtos p WHERE p.user_id = u.id) AS total_produtos,
    (SELECT COUNT(*) FROM public.produtos p WHERE p.user_id = u.id AND p.ativo = false) AS total_produtos_inativos,
    (SELECT COUNT(*) FROM public.fornecedores f WHERE f.user_id = u.id) AS total_fornecedores,
    (SELECT COUNT(*) FROM public.cotacoes c WHERE c.created_by = u.id) AS total_cotacoes,
    (SELECT COUNT(*) FROM public.pedidos pe WHERE pe.created_by = u.id) AS total_pedidos,
    COALESCE(p.name, 'free') AS plan_name,
    COALESCE(s.status::TEXT, 'none') AS plan_status,
    s.current_period_end AS trial_end,
    (SELECT MAX(c.created_at) FROM public.cotacoes c WHERE c.created_by = u.id) AS ultima_cotacao_at
  FROM auth.users u
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LEFT JOIN public.plans p ON p.id = s.plan_id
  ORDER BY u.id, u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_global_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  total_users INT;
  users_with_cotacao INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(DISTINCT created_by) INTO users_with_cotacao FROM public.cotacoes WHERE created_by IS NOT NULL;

  SELECT jsonb_build_object(
    'total_usuarios', total_users,
    'usuarios_7d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'usuarios_30d', (SELECT COUNT(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'total_lojas', (SELECT COUNT(*) FROM public.lojas),
    'total_produtos', (SELECT COUNT(*) FROM public.produtos),
    'total_produtos_ativos', (SELECT COUNT(*) FROM public.produtos WHERE ativo = true),
    'total_fornecedores', (SELECT COUNT(*) FROM public.fornecedores),
    'total_cotacoes', (SELECT COUNT(*) FROM public.cotacoes),
    'cotacoes_ativas', (SELECT COUNT(*) FROM public.cotacoes WHERE status = 'ativa'),
    'cotacoes_finalizadas', (SELECT COUNT(*) FROM public.cotacoes WHERE status = 'finalizada'),
    'total_pedidos', (SELECT COUNT(*) FROM public.pedidos),
    'pedidos_enviados', (SELECT COUNT(*) FROM public.pedidos WHERE status = 'enviado'),
    'total_conferencias', (SELECT COUNT(*) FROM public.conferencias),
    'plan_distribution', (
      SELECT jsonb_object_agg(plan_name, total) FROM (
        SELECT COALESCE(p.name, 'free') AS plan_name, COUNT(*)::int AS total
        FROM (
          SELECT DISTINCT ON (u.id) u.id, s.plan_id
          FROM auth.users u
          LEFT JOIN public.subscriptions s ON s.user_id = u.id
            AND s.status IN ('active', 'trialing')
            AND (s.current_period_end IS NULL OR s.current_period_end > now())
          ORDER BY u.id, s.created_at DESC NULLS LAST
        ) sub
        LEFT JOIN public.plans p ON p.id = sub.plan_id
        GROUP BY COALESCE(p.name, 'free')
      ) t
    ),
    'mrr_estimado', (
      SELECT COALESCE(SUM(p.price_monthly), 0)
      FROM public.subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
      WHERE s.status = 'active'
    ),
    'trials_ativos', (
      SELECT COUNT(*) FROM public.subscriptions WHERE status = 'trialing' AND current_period_end > now()
    ),
    'trials_expirando_7d', (
      SELECT COUNT(*) FROM public.subscriptions 
      WHERE status = 'trialing' 
        AND current_period_end > now() 
        AND current_period_end <= now() + interval '7 days'
    ),
    'em_risco_churn', (
      SELECT COUNT(*) FROM auth.users u
      WHERE EXISTS (SELECT 1 FROM public.cotacoes c WHERE c.created_by = u.id)
        AND NOT EXISTS (
          SELECT 1 FROM public.cotacoes c 
          WHERE c.created_by = u.id 
            AND c.created_at > now() - interval '15 days'
        )
    ),
    'taxa_ativacao', CASE WHEN total_users > 0 THEN ROUND((users_with_cotacao::numeric / total_users::numeric) * 100, 1) ELSE 0 END
  ) INTO result;

  RETURN result;
END;
$function$;