
-- Trial controls table
CREATE TABLE public.trial_controls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  cnpj text,
  device_fingerprint text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own trial_controls"
  ON public.trial_controls FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own trial_controls"
  ON public.trial_controls FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create unique partial indexes (ignore nulls)
CREATE UNIQUE INDEX idx_trial_controls_cnpj ON public.trial_controls (cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX idx_trial_controls_fingerprint ON public.trial_controls (device_fingerprint) WHERE device_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX idx_trial_controls_phone ON public.trial_controls (phone) WHERE phone IS NOT NULL;

-- Function to check trial eligibility
CREATE OR REPLACE FUNCTION public.check_trial_eligibility(_cnpj text DEFAULT NULL, _fingerprint text DEFAULT NULL, _phone text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _blocked_by text := NULL;
BEGIN
  -- Check CNPJ
  IF _cnpj IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trial_controls WHERE cnpj = _cnpj
  ) THEN
    _blocked_by := 'cnpj';
  END IF;

  -- Check fingerprint
  IF _blocked_by IS NULL AND _fingerprint IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trial_controls WHERE device_fingerprint = _fingerprint
  ) THEN
    _blocked_by := 'fingerprint';
  END IF;

  -- Check phone
  IF _blocked_by IS NULL AND _phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trial_controls WHERE phone = _phone
  ) THEN
    _blocked_by := 'phone';
  END IF;

  RETURN jsonb_build_object(
    'eligible', _blocked_by IS NULL,
    'blocked_by', _blocked_by
  );
END;
$$;

-- Update the trial creation trigger to check eligibility
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  _business_plan_id uuid;
  _cnpj text;
  _eligibility jsonb;
BEGIN
  -- Only if user has no subscription yet
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.user_id) THEN
    -- Get CNPJ from the loja being created
    _cnpj := NEW.cnpj;

    -- Check eligibility using CNPJ (fingerprint checked client-side before insert)
    SELECT public.check_trial_eligibility(_cnpj, NULL, NULL) INTO _eligibility;

    IF (_eligibility->>'eligible')::boolean THEN
      SELECT id INTO _business_plan_id FROM public.plans WHERE name = 'business' LIMIT 1;
      
      INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
      VALUES (
        NEW.user_id,
        _business_plan_id,
        'trialing',
        now(),
        now() + interval '30 days'
      );

      -- Record trial control with CNPJ
      INSERT INTO public.trial_controls (user_id, cnpj)
      VALUES (NEW.user_id, _cnpj)
      ON CONFLICT (user_id) DO UPDATE SET cnpj = EXCLUDED.cnpj;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
