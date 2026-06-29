
CREATE OR REPLACE FUNCTION public.search_produtos_hibrido(_termo text, _limit integer DEFAULT 30)
RETURNS TABLE(fonte text, id uuid, nome text, ean text, embalagem text, fator_embalagem integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_numeric boolean := _termo ~ '^[0-9]+$';
  _like text := '%' || coalesce(_termo,'') || '%';
  _ean_prefix text := coalesce(_termo,'') || '%';
BEGIN
  IF _uid IS NULL OR coalesce(_termo,'') = '' THEN RETURN; END IF;

  RETURN QUERY
  WITH globais AS (
    SELECT 'catalogo'::text AS fonte, cm.id, cm.nome, cm.ean,
           cm.embalagem, cm.fator_embalagem, 0 AS ord
    FROM public.catalogo_mestre cm
    WHERE cm.ativo = true
      AND (cm.nome ILIKE _like OR (_is_numeric AND cm.ean LIKE _ean_prefix))
    ORDER BY cm.nome
    LIMIT _limit
  ),
  locais AS (
    SELECT 'local'::text AS fonte, p.id, p.nome, NULL::text AS ean,
           p.embalagem, p.fator_embalagem, 1 AS ord
    FROM public.produtos p
    WHERE p.user_id = _uid
      AND p.ativo = true
      AND p.nome ILIKE _like
      AND lower(p.nome) NOT IN (SELECT lower(g.nome) FROM globais g)
    ORDER BY p.nome
    LIMIT _limit
  )
  SELECT u.fonte, u.id, u.nome, u.ean, u.embalagem, u.fator_embalagem
  FROM (SELECT * FROM globais UNION ALL SELECT * FROM locais) u
  ORDER BY u.ord, u.nome
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_produtos_hibrido(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_produtos_funcionario(_loja_id uuid, _termo text, _limit integer DEFAULT 30)
RETURNS TABLE(fonte text, id uuid, nome text, ean text, embalagem text, fator_embalagem integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _is_numeric boolean := _termo ~ '^[0-9]+$';
  _like text := '%' || coalesce(_termo,'') || '%';
  _ean_prefix text := coalesce(_termo,'') || '%';
BEGIN
  SELECT user_id INTO _owner FROM public.lojas WHERE id = _loja_id;
  IF _owner IS NULL OR coalesce(_termo,'') = '' THEN RETURN; END IF;

  RETURN QUERY
  WITH globais AS (
    SELECT 'catalogo'::text AS fonte, cm.id, cm.nome, cm.ean,
           cm.embalagem, cm.fator_embalagem, 0 AS ord
    FROM public.catalogo_mestre cm
    WHERE cm.ativo = true
      AND (cm.nome ILIKE _like OR (_is_numeric AND cm.ean LIKE _ean_prefix))
    ORDER BY cm.nome
    LIMIT _limit
  ),
  locais AS (
    SELECT 'local'::text AS fonte, p.id, p.nome, NULL::text AS ean,
           p.embalagem, p.fator_embalagem, 1 AS ord
    FROM public.produtos p
    WHERE p.user_id = _owner
      AND p.ativo = true
      AND p.nome ILIKE _like
      AND lower(p.nome) NOT IN (SELECT lower(g.nome) FROM globais g)
    ORDER BY p.nome
    LIMIT _limit
  )
  SELECT u.fonte, u.id, u.nome, u.ean, u.embalagem, u.fator_embalagem
  FROM (SELECT * FROM globais UNION ALL SELECT * FROM locais) u
  ORDER BY u.ord, u.nome
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_produtos_funcionario(uuid, text, integer) TO anon, authenticated;
