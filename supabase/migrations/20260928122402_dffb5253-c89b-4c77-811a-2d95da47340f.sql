ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS razao_social text;

DROP FUNCTION IF EXISTS public.salvar_dados_fornecedor(text, text, text[], text, jsonb);

CREATE OR REPLACE FUNCTION public.salvar_dados_fornecedor(_token text, _cnpj text DEFAULT NULL::text, _pasta text[] DEFAULT NULL::text[], _consentimento text DEFAULT NULL::text, _cidades jsonb DEFAULT NULL::jsonb, _razao_social text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _id uuid;
  _ids uuid[];
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _rs text := NULLIF(left(btrim(COALESCE(_razao_social,'')), 200), '');
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN RETURN false; END IF;

  IF _consentimento IS NOT NULL AND _consentimento NOT IN ('sim','nao') THEN
    RAISE EXCEPTION 'Consentimento inválido';
  END IF;

  IF length(_cnpj_digits) <> 14 THEN _cnpj_digits := NULL; END IF;

  SELECT array_agg(g.id) INTO _ids
  FROM (
    SELECT id FROM public.fornecedor_grupo_ids(_id)
    UNION
    SELECT f.id FROM public.fornecedores f
    WHERE _cnpj_digits IS NOT NULL
      AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_digits
  ) g;

  IF _cnpj_digits IS NOT NULL THEN
    UPDATE public.fornecedores
      SET cnpj = _cnpj_digits,
          razao_social = COALESCE(_rs, razao_social),
          consentimento_tentativas_skip = 0,
          updated_at = now()
    WHERE id = ANY(_ids);
  END IF;

  IF _pasta IS NOT NULL AND array_length(_pasta, 1) > 0 THEN
    UPDATE public.fornecedores SET pasta = _pasta, updated_at = now() WHERE id = ANY(_ids);
  END IF;

  IF _consentimento IS NOT NULL THEN
    UPDATE public.fornecedores
      SET consentimento_rede = _consentimento,
          consentimento_ultima_pergunta = now(),
          consentimento_recusas = CASE WHEN _consentimento = 'nao' THEN consentimento_recusas + 1 ELSE consentimento_recusas END,
          updated_at = now()
    WHERE id = ANY(_ids);
  END IF;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    WITH novas AS (
      SELECT DISTINCT
        btrim(x->>'cidade') AS cidade,
        NULLIF(upper(btrim(COALESCE(x->>'uf',''))), '') AS uf,
        public.norm_cidade(x->>'cidade') AS cidade_norm
      FROM jsonb_array_elements(_cidades) x
      WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ),
    alvos AS (SELECT unnest(_ids) AS fid),
    removidas AS (
      DELETE FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = ANY(_ids)
        AND NOT EXISTS (SELECT 1 FROM novas n WHERE n.cidade_norm = c.cidade_norm AND COALESCE(n.uf,'') = COALESCE(c.uf,''))
      RETURNING 1
    )
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT a.fid, n.cidade, n.uf, n.cidade_norm
    FROM alvos a CROSS JOIN novas n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = a.fid AND c.cidade_norm = n.cidade_norm AND COALESCE(c.uf,'') = COALESCE(n.uf,'')
    );
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text, jsonb, text) TO anon, authenticated, service_role;