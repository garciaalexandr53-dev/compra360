CREATE OR REPLACE FUNCTION public.resolver_loja_por_codigo(_codigo text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limpo text := lower(regexp_replace(coalesce(_codigo, ''), '[^0-9a-zA-Z]', '', 'g'));
  _ids uuid[];
BEGIN
  IF length(_limpo) = 14 AND _limpo ~ '^[0-9]+$' THEN
    SELECT array_agg(id) INTO _ids FROM lojas
     WHERE ativo AND regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') = _limpo;
  ELSIF length(_limpo) = 8 AND _limpo ~ '^[0-9a-f]+$' THEN
    SELECT array_agg(id) INTO _ids FROM lojas
     WHERE ativo AND left(replace(id::text, '-', ''), 8) = _limpo;
  ELSE
    RETURN NULL;
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) <> 1 THEN
    RETURN NULL;
  END IF;
  RETURN _ids[1];
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolver_loja_por_codigo(text) TO anon, authenticated;