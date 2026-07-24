CREATE OR REPLACE FUNCTION public.set_cotacao_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL THEN
    NEW.created_by := _uid;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_cotacao_created_by() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_cotacao_created_by() FROM anon;
REVOKE ALL ON FUNCTION public.set_cotacao_created_by() FROM authenticated;