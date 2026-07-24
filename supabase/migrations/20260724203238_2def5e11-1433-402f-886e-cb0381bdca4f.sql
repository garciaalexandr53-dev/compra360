CREATE OR REPLACE FUNCTION public.set_cotacao_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS set_cotacao_created_by_before_insert ON public.cotacoes;

CREATE TRIGGER set_cotacao_created_by_before_insert
BEFORE INSERT ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.set_cotacao_created_by();