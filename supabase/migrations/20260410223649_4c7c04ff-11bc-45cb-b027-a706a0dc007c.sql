
-- Function to auto-create trial subscription on first loja
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _business_plan_id uuid;
BEGIN
  -- Only if user has no subscription yet
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.user_id) THEN
    SELECT id INTO _business_plan_id FROM public.plans WHERE name = 'business' LIMIT 1;
    
    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
    VALUES (
      NEW.user_id,
      _business_plan_id,
      'trialing',
      now(),
      now() + interval '30 days'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on first loja creation
CREATE TRIGGER trigger_create_trial_on_first_loja
  AFTER INSERT ON public.lojas
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_subscription();

-- Update get_user_plan to handle expired trials (return free plan)
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid DEFAULT auth.uid())
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  -- Active or trialing subscription (not expired)
  SELECT jsonb_build_object(
    'plan_name', p.name,
    'display_name', p.display_name,
    'max_lojas', p.max_lojas,
    'max_produtos', p.max_produtos,
    'max_fornecedores', p.max_fornecedores,
    'max_cotacoes_simultaneas', p.max_cotacoes_simultaneas,
    'features', p.features,
    'status', s.status::text,
    'current_period_end', s.current_period_end,
    'is_trial', (s.status = 'trialing')
  )
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  UNION ALL
  -- Fallback: free plan
  SELECT jsonb_build_object(
    'plan_name', p.name,
    'display_name', p.display_name,
    'max_lojas', p.max_lojas,
    'max_produtos', p.max_produtos,
    'max_fornecedores', p.max_fornecedores,
    'max_cotacoes_simultaneas', p.max_cotacoes_simultaneas,
    'features', p.features,
    'status', 'active',
    'current_period_end', null,
    'is_trial', false
  )
  FROM public.plans p
  WHERE p.name = 'free'
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s2
      WHERE s2.user_id = _user_id
        AND s2.status IN ('active', 'trialing')
        AND (s2.current_period_end IS NULL OR s2.current_period_end > now())
    )
  LIMIT 1
$$;
