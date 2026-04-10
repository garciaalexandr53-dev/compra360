
-- Plans table
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  max_lojas integer NOT NULL DEFAULT 1,
  max_produtos integer NOT NULL DEFAULT 50,
  max_fornecedores integer NOT NULL DEFAULT 5,
  max_cotacoes_simultaneas integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  USING (active = true);

-- Subscriptions table
CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own subscription"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to get user plan with limits
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid DEFAULT auth.uid())
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan_name', p.name,
    'display_name', p.display_name,
    'max_lojas', p.max_lojas,
    'max_produtos', p.max_produtos,
    'max_fornecedores', p.max_fornecedores,
    'max_cotacoes_simultaneas', p.max_cotacoes_simultaneas,
    'features', p.features,
    'status', COALESCE(s.status::text, 'active'),
    'current_period_end', s.current_period_end
  )
  FROM public.plans p
  LEFT JOIN public.subscriptions s ON s.plan_id = p.id AND s.user_id = _user_id
  WHERE s.user_id = _user_id
  UNION ALL
  SELECT jsonb_build_object(
    'plan_name', p.name,
    'display_name', p.display_name,
    'max_lojas', p.max_lojas,
    'max_produtos', p.max_produtos,
    'max_fornecedores', p.max_fornecedores,
    'max_cotacoes_simultaneas', p.max_cotacoes_simultaneas,
    'features', p.features,
    'status', 'active',
    'current_period_end', null
  )
  FROM public.plans p
  WHERE p.name = 'free' AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s2 WHERE s2.user_id = _user_id
  )
  LIMIT 1
$$;

-- Insert the 3 default plans
INSERT INTO public.plans (name, display_name, price_monthly, max_lojas, max_produtos, max_fornecedores, max_cotacoes_simultaneas, features) VALUES
  ('free', 'Grátis', 0, 1, 50, 5, 1, '["Cotação básica", "1 loja", "Até 50 produtos", "Até 5 fornecedores"]'::jsonb),
  ('pro', 'Pro', 79.90, 3, 500, 30, 3, '["Até 3 lojas", "Até 500 produtos", "Até 30 fornecedores", "Análise de preços com IA", "Previsão de demanda", "Alertas de reposição"]'::jsonb),
  ('business', 'Business', 199.90, -1, -1, -1, -1, '["Lojas ilimitadas", "Produtos ilimitados", "Fornecedores ilimitados", "Todas as funcionalidades IA", "Negociação assistida", "Suporte prioritário"]'::jsonb);
