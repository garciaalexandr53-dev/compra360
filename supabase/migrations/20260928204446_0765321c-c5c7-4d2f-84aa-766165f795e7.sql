CREATE OR REPLACE FUNCTION public.whatsapp_parceiro_existe(_telefone text, _cnpj text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _fone_key text;
  _cnpj_d text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _empresas jsonb;
  _mesma boolean := false;
  _na_rede boolean := false;
  _ficha public.fornecedores;
  _cidades jsonb;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN _fone := substr(_fone, 3); END IF;
  IF length(_fone) NOT IN (10, 11) THEN RETURN jsonb_build_object('existe', false); END IF;
  _fone_key := public.fornecedor_fone_key(_fone);

  WITH base AS (
    SELECT f.nome,
           public.fornecedor_cnpj_key(f.cnpj) AS ck,
           upper(btrim(f.nome)) AS nk,
           f.created_at
    FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
  ), chaves AS (
    SELECT COALESCE(
             (SELECT b2.ck FROM base b2 WHERE b2.nk = b.nk AND b2.ck IS NOT NULL LIMIT 1),
             b.ck, b.nk) AS grupo,
           b.nome, b.created_at
    FROM base b
  ), r AS (
    SELECT DISTINCT ON (grupo) nome FROM chaves ORDER BY grupo, created_at DESC
  )
  SELECT jsonb_agg(r.nome ORDER BY r.nome) INTO _empresas FROM r;

  IF _empresas IS NULL THEN RETURN jsonb_build_object('existe', false); END IF;

  IF length(_cnpj_d) = 14 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
        AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_d
    ) INTO _mesma;
  END IF;

  SELECT * INTO _ficha
  FROM public.fornecedores f
  WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
    AND (length(_cnpj_d) <> 14 OR public.fornecedor_cnpj_key(f.cnpj) = _cnpj_d)
  ORDER BY
    (length(_cnpj_d) = 14 AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_d) DESC,
    (f.cnpj IS NOT NULL) DESC,
    (f.user_id IS NULL) DESC,
    f.updated_at DESC
  LIMIT 1;

  IF _ficha.id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', COALESCE(c.uf, ''))
                     ORDER BY c.cidade)
    INTO _cidades
    FROM public.fornecedor_cidades_atendidas c
    WHERE c.fornecedor_id = _ficha.id;

    SELECT EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
        AND f.consentimento_rede = 'sim'
        AND (f.user_id IS NULL OR f.origem_cadastro LIKE 'autocadastro%')
        AND (public.fornecedor_cnpj_key(f.cnpj) IS NOT DISTINCT FROM public.fornecedor_cnpj_key(_ficha.cnpj)
             OR upper(btrim(f.nome)) = upper(btrim(_ficha.nome)))
    ) INTO _na_rede;
  END IF;

  RETURN jsonb_build_object(
    'existe', true,
    'nome', _empresas->>0,
    'empresas', _empresas,
    'mesma_empresa', COALESCE(_mesma, false),
    'ficha', CASE WHEN _ficha.id IS NULL THEN NULL ELSE jsonb_build_object(
      'nome', _ficha.nome,
      'representante', _ficha.representante,
      'cnpj', _ficha.cnpj,
      'tipo_fornecedor', _ficha.tipo_fornecedor,
      'pasta', to_jsonb(COALESCE(_ficha.pasta, ARRAY[]::text[])),
      'cidades', COALESCE(_cidades, '[]'::jsonb),
      'na_rede', COALESCE(_na_rede, false)
    ) END
  );
END;
$function$;