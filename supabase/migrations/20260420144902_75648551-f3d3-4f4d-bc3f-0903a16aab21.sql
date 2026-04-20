-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Atalho is_admin para o usuário atual
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

-- 5. RLS em user_roles: somente admins podem ler/gerenciar
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can read their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 6. RPC: lista de clientes
CREATE OR REPLACE FUNCTION public.admin_list_clientes()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  loja_principal TEXT,
  cnpj TEXT,
  total_lojas BIGINT,
  total_produtos BIGINT,
  total_produtos_inativos BIGINT,
  total_fornecedores BIGINT,
  total_cotacoes BIGINT,
  total_pedidos BIGINT,
  plan_name TEXT,
  plan_status TEXT,
  trial_end TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
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
    s.current_period_end AS trial_end
  FROM auth.users u
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LEFT JOIN public.plans p ON p.id = s.plan_id
  ORDER BY u.created_at DESC;
END;
$$;

-- 7. RPC: métricas globais
CREATE OR REPLACE FUNCTION public.admin_global_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'total_usuarios', (SELECT COUNT(*) FROM auth.users),
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
        FROM auth.users u
        LEFT JOIN public.subscriptions s ON s.user_id = u.id
          AND s.status IN ('active', 'trialing')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        LEFT JOIN public.plans p ON p.id = s.plan_id
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
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 8. RPC: ativar todos os produtos de um cliente
CREATE OR REPLACE FUNCTION public.admin_activate_all_produtos(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE public.produtos SET ativo = true WHERE user_id = _user_id AND ativo = false;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 9. RPC: alterar plano de um cliente
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user_id UUID, _plan_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id UUID;
  _existing UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT id INTO _plan_id FROM public.plans WHERE name = _plan_name LIMIT 1;
  IF _plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', _plan_name;
  END IF;

  SELECT id INTO _existing FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;

  IF _existing IS NULL THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
    VALUES (_user_id, _plan_id, 'active', now(), now() + interval '30 days');
  ELSE
    UPDATE public.subscriptions
    SET plan_id = _plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + interval '30 days',
        canceled_at = NULL,
        updated_at = now()
    WHERE id = _existing;
  END IF;

  RETURN jsonb_build_object('success', true, 'plan', _plan_name);
END;
$$;