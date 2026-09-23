CREATE OR REPLACE FUNCTION public.fornecedor_fone_key(_telefone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(right(regexp_replace(COALESCE(_telefone,''), '\D', '', 'g'), 8), '')
$$;

CREATE OR REPLACE FUNCTION public.fornecedor_cnpj_key(_cnpj text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g')) = 14
              THEN regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g') END
$$;

CREATE OR REPLACE FUNCTION public.fornecedor_grupo_ids(_id uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH alvo AS (
    SELECT f.id,
           public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key
    FROM public.fornecedores f WHERE f.id = _id
  )
  SELECT f.id
  FROM public.fornecedores f, alvo a
  WHERE f.id = a.id
     OR (a.fone_key IS NOT NULL AND public.fornecedor_fone_key(f.telefone) = a.fone_key)
     OR (a.cnpj_key IS NOT NULL AND public.fornecedor_cnpj_key(f.cnpj) = a.cnpj_key)
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_onboarding_state(_token text, _cotacao_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(pedir_cnpj boolean, pedir_pasta boolean, pedir_consentimento boolean, permite_skip boolean, pasta text[], tipo_fornecedor text, pedir_cidades boolean, participa_rede boolean, cidades jsonb, cidade_loja text, uf_loja text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  WITH alvo AS (
    SELECT f.* FROM public.fornecedores f WHERE f.token = _token LIMIT 1
  ),
  grupo AS (
    SELECT f.*
    FROM public.fornecedores f
    WHERE f.id IN (SELECT g.id FROM public.fornecedor_grupo_ids((SELECT id FROM alvo)) g)
  ),
  agg AS (
    SELECT
      bool_or(g.consentimento_rede = 'sim') AS tem_sim,
      max(public.fornecedor_cnpj_key(g.cnpj)) AS cnpj_key,
      max(g.consentimento_recusas) AS recusas,
      max(g.consentimento_ultima_pergunta) AS ultima_pergunta,
      (SELECT g2.pasta FROM grupo g2
         ORDER BY COALESCE(array_length(g2.pasta,1),0) DESC, g2.created_at LIMIT 1) AS pasta_grupo,
      (SELECT g3.tipo_fornecedor FROM grupo g3
         ORDER BY (g3.tipo_fornecedor IS NULL), g3.created_at LIMIT 1) AS tipo_grupo,
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object('cidade', c.cidade, 'uf', c.uf))
        FROM public.fornecedor_cidades_atendidas c
        WHERE c.fornecedor_id IN (SELECT gg.id FROM grupo gg)
      ), '[]'::jsonb) AS cidades_grupo
    FROM grupo g
  )
  SELECT
    (ag.cnpj_key IS NULL) AS pedir_cnpj,
    (COALESCE(array_length(ag.pasta_grupo, 1), 0) = 0) AS pedir_pasta,
    CASE
      WHEN ag.tem_sim THEN false
      WHEN a.consentimento_rede = 'pendente' AND COALESCE(ag.recusas,0) = 0 THEN true
      WHEN COALESCE(ag.recusas,0) >= 2 THEN false
      ELSE (ag.ultima_pergunta IS NULL OR ag.ultima_pergunta <= now() - interval '90 days')
    END AS pedir_consentimento,
    (a.consentimento_tentativas_skip < 3) AS permite_skip,
    ag.pasta_grupo AS pasta,
    ag.tipo_grupo AS tipo_fornecedor,
    (ag.tem_sim AND jsonb_array_length(ag.cidades_grupo) = 0) AS pedir_cidades,
    ag.tem_sim AS participa_rede,
    ag.cidades_grupo AS cidades,
    (SELECT l.cidade FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = a.id
      WHERE co.id = _cotacao_id LIMIT 1) AS cidade_loja,
    (SELECT l.uf FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = a.id
      WHERE co.id = _cotacao_id LIMIT 1) AS uf_loja
  FROM alvo a CROSS JOIN agg ag
$function$;

CREATE OR REPLACE FUNCTION public.salvar_dados_fornecedor(_token text, _cnpj text DEFAULT NULL::text, _pasta text[] DEFAULT NULL::text[], _consentimento text DEFAULT NULL::text, _cidades jsonb DEFAULT NULL::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _id uuid;
  _ids uuid[];
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN
    RETURN false;
  END IF;

  IF _consentimento IS NOT NULL AND _consentimento NOT IN ('sim','nao') THEN
    RAISE EXCEPTION 'Consentimento inválido';
  END IF;

  IF length(_cnpj_digits) <> 14 THEN
    _cnpj_digits := NULL;
  END IF;

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
          consentimento_tentativas_skip = 0,
          updated_at = now()
    WHERE id = ANY(_ids);
  END IF;

  IF _pasta IS NOT NULL AND array_length(_pasta, 1) > 0 THEN
    UPDATE public.fornecedores
      SET pasta = _pasta,
          updated_at = now()
    WHERE id = ANY(_ids);
  END IF;

  IF _consentimento IS NOT NULL THEN
    UPDATE public.fornecedores
      SET consentimento_rede = _consentimento,
          consentimento_ultima_pergunta = now(),
          consentimento_recusas = CASE
            WHEN _consentimento = 'nao' THEN consentimento_recusas + 1
            ELSE consentimento_recusas
          END,
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
        AND NOT EXISTS (
          SELECT 1 FROM novas n
          WHERE n.cidade_norm = c.cidade_norm
            AND COALESCE(n.uf,'') = COALESCE(c.uf,'')
        )
      RETURNING 1
    )
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT a.fid, n.cidade, n.uf, n.cidade_norm
    FROM alvos a CROSS JOIN novas n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = a.fid
        AND c.cidade_norm = n.cidade_norm
        AND COALESCE(c.uf,'') = COALESCE(n.uf,'')
    );
  END IF;

  RETURN true;
END;
$function$;
