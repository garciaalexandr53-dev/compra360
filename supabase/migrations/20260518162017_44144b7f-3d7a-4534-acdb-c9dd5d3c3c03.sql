
CREATE TABLE public.admin_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp','email')),
  motivo text NOT NULL CHECK (motivo IN ('trial_expirando','risco_churn','sem_ativacao','manual')),
  observacao text,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_contatos_user_id_created ON public.admin_contatos(user_id, created_at DESC);

ALTER TABLE public.admin_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin_contatos"
  ON public.admin_contatos FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert admin_contatos"
  ON public.admin_contatos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

CREATE POLICY "Admins can update admin_contatos"
  ON public.admin_contatos FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete admin_contatos"
  ON public.admin_contatos FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_registrar_contato(
  _user_id uuid, _canal text, _motivo text, _observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  IF _canal NOT IN ('whatsapp','email') THEN
    RAISE EXCEPTION 'Canal inválido';
  END IF;
  IF _motivo NOT IN ('trial_expirando','risco_churn','sem_ativacao','manual') THEN
    RAISE EXCEPTION 'Motivo inválido';
  END IF;
  INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
  VALUES (_user_id, _canal, _motivo, _observacao, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_contatos_cliente(_user_id uuid, _limit int DEFAULT 10)
RETURNS TABLE(id uuid, canal text, motivo text, observacao text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
    SELECT c.id, c.canal, c.motivo, c.observacao, c.created_at
    FROM public.admin_contatos c
    WHERE c.user_id = _user_id
    ORDER BY c.created_at DESC
    LIMIT _limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_ultimos_contatos()
RETURNS TABLE(user_id uuid, canal text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ON (c.user_id) c.user_id, c.canal, c.created_at
    FROM public.admin_contatos c
    ORDER BY c.user_id, c.created_at DESC;
END;
$$;
