CREATE OR REPLACE FUNCTION public.get_lojas_public(_loja_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _loja_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT l.id, l.nome FROM public.lojas l WHERE l.id = _loja_id AND l.ativo;
END;
$function$;
CREATE OR REPLACE FUNCTION public.loja_exists(_loja_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.lojas WHERE id = _loja_id AND ativo) $function$;