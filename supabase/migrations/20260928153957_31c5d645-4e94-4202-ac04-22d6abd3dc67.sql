CREATE OR REPLACE FUNCTION public.fornecedor_mesma_entidade(_fa text, _ca text, _fb text, _cb text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _fa IS NOT NULL AND _fb IS NOT NULL THEN
      _fa = _fb AND (_ca IS NULL OR _cb IS NULL OR _ca = _cb)
    ELSE _ca IS NOT NULL AND _cb IS NOT NULL AND _ca = _cb
  END
$$;

CREATE OR REPLACE FUNCTION public.fornecedor_grupo_ids(_id uuid)
 RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH alvo AS (
    SELECT f.id, public.fornecedor_fone_key(f.telefone) AS fone_key, public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key
    FROM public.fornecedores f WHERE f.id = _id
  )
  SELECT f.id FROM public.fornecedores f, alvo a
  WHERE f.id = a.id
     OR public.fornecedor_mesma_entidade(a.fone_key, a.cnpj_key, public.fornecedor_fone_key(f.telefone), public.fornecedor_cnpj_key(f.cnpj))
$function$;

CREATE OR REPLACE FUNCTION public.sugerir_fornecedores_por_cidade(_loja_id uuid)
 RETURNS TABLE(id uuid, nome text, representante text, telefone text, tipo_fornecedor text, pasta text[], pedido_minimo numeric, prazo_pagamento text, total_cotacoes integer, total_respondidas integer, tempo_medio_horas numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cidade_norm text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT public.norm_cidade(l.cidade) INTO _cidade_norm
  FROM public.lojas l WHERE l.id = _loja_id AND l.user_id = _uid;
  IF _cidade_norm IS NULL OR _cidade_norm = '' THEN RETURN; END IF;

  RETURN QUERY
  WITH meus AS (
    SELECT public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
           public.norm_cidade(f.nome) AS nome_norm,
           public.norm_cidade(COALESCE(f.representante, '')) AS rep_norm
    FROM public.fornecedores f WHERE f.user_id = _uid
  ),
  base AS (
    SELECT f.* FROM public.fornecedores f
    WHERE (f.user_id IS NULL OR f.user_id <> _uid)
      AND f.consentimento_rede = 'sim'
      AND NOT EXISTS (SELECT 1 FROM public.fornecedor_lojas fl2 WHERE fl2.fornecedor_id = f.id AND fl2.loja_id = _loja_id)
      AND (
        EXISTS (SELECT 1 FROM public.fornecedor_cidades_atendidas c WHERE c.fornecedor_id = f.id AND c.cidade_norm = _cidade_norm)
        OR EXISTS (
          SELECT 1 FROM public.fornecedor_lojas fl JOIN public.lojas l ON l.id = fl.loja_id
          WHERE fl.fornecedor_id = f.id AND fl.loja_id <> _loja_id AND public.norm_cidade(l.cidade) = _cidade_norm)
      )
  ),
  cand AS (
    SELECT b.id, b.nome, b.representante, b.telefone, b.tipo_fornecedor, b.pasta,
      b.pedido_minimo, b.prazo_pagamento, b.created_at,
      public.fornecedor_fone_key(b.telefone) AS fone_key,
      public.fornecedor_cnpj_key(b.cnpj) AS cnpj_key,
      public.norm_cidade(b.nome) AS nome_norm,
      public.norm_cidade(COALESCE(b.representante, '')) AS rep_norm,
      length(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g')) AS fone_digitos
    FROM base b
  ),
  sem_meus AS (
    SELECT c.* FROM cand c
    WHERE NOT EXISTS (
      SELECT 1 FROM meus m
      WHERE public.fornecedor_mesma_entidade(c.fone_key, c.cnpj_key, m.fone_key, m.cnpj_key)
         OR (c.fone_key IS NULL AND c.cnpj_key IS NULL AND m.nome_norm = c.nome_norm AND m.rep_norm = c.rep_norm))
  ),
  chaveado AS (
    SELECT s.*, COALESCE('f:' || s.fone_key || '|' || COALESCE(s.cnpj_key, ''), 'c:' || s.cnpj_key, 'n:' || s.nome_norm || '|' || s.rep_norm) AS grupo_key
    FROM sem_meus s
  ),
  dedup AS (
    SELECT DISTINCT ON (k.grupo_key) k.* FROM chaveado k
    ORDER BY k.grupo_key, (k.cnpj_key IS NOT NULL) DESC, (k.fone_digitos >= 11) DESC,
      (k.prazo_pagamento IS NOT NULL) DESC, (k.pedido_minimo IS NOT NULL) DESC,
      (COALESCE(array_length(k.pasta, 1), 0)) DESC, k.created_at DESC
  ),
  conv AS (SELECT * FROM public._fornecedor_convocacoes())
  SELECT d.id, d.nome, d.representante, d.telefone, d.tipo_fornecedor, d.pasta,
         d.pedido_minimo, d.prazo_pagamento,
         COALESCE(st.total, 0)::int, COALESCE(st.resp, 0)::int, st.horas
  FROM dedup d
  LEFT JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE cv.respondeu) AS resp, round(avg(cv.horas), 1) AS horas
    FROM conv cv JOIN public.fornecedores f2 ON f2.id = cv.fornecedor_id
    WHERE f2.id = d.id
       OR public.fornecedor_mesma_entidade(d.fone_key, d.cnpj_key, public.fornecedor_fone_key(f2.telefone), public.fornecedor_cnpj_key(f2.cnpj))
  ) st ON true
  ORDER BY d.nome_norm ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.copiar_fornecedores_para_loja(_loja_id uuid, _fornecedor_ids uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _total integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = _loja_id AND l.user_id = _uid) THEN
    RAISE EXCEPTION 'Loja não pertence ao usuário';
  END IF;
  IF _fornecedor_ids IS NULL OR array_length(_fornecedor_ids, 1) IS NULL THEN RETURN 0; END IF;

  WITH meus AS (
    SELECT public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
           public.norm_cidade(f.nome) AS nome_norm,
           public.norm_cidade(COALESCE(f.representante, '')) AS rep_norm
    FROM public.fornecedores f WHERE f.user_id = _uid
  ),
  origem AS (
    SELECT DISTINCT ON (
      COALESCE('f:' || public.fornecedor_fone_key(f.telefone) || '|' || COALESCE(public.fornecedor_cnpj_key(f.cnpj), ''),
               'c:' || public.fornecedor_cnpj_key(f.cnpj),
               'n:' || public.norm_cidade(f.nome) || '|' || public.norm_cidade(COALESCE(f.representante, '')))
    ) f.*
    FROM public.fornecedores f
    WHERE f.id = ANY(_fornecedor_ids) AND (f.user_id IS NULL OR f.user_id <> _uid)
    ORDER BY
      COALESCE('f:' || public.fornecedor_fone_key(f.telefone) || '|' || COALESCE(public.fornecedor_cnpj_key(f.cnpj), ''),
               'c:' || public.fornecedor_cnpj_key(f.cnpj),
               'n:' || public.norm_cidade(f.nome) || '|' || public.norm_cidade(COALESCE(f.representante, ''))),
      (public.fornecedor_cnpj_key(f.cnpj) IS NOT NULL) DESC,
      (length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 11) DESC,
      f.created_at DESC
  ),
  filtrados AS (
    SELECT o.* FROM origem o
    WHERE NOT EXISTS (
      SELECT 1 FROM meus m
      WHERE public.fornecedor_mesma_entidade(public.fornecedor_fone_key(o.telefone), public.fornecedor_cnpj_key(o.cnpj), m.fone_key, m.cnpj_key)
         OR (public.fornecedor_fone_key(o.telefone) IS NULL AND public.fornecedor_cnpj_key(o.cnpj) IS NULL
             AND m.nome_norm = public.norm_cidade(o.nome)
             AND m.rep_norm = public.norm_cidade(COALESCE(o.representante, ''))))
  ),
  novos AS (
    INSERT INTO public.fornecedores (
      nome, representante, telefone, email, pedido_minimo, prazo_pagamento,
      observacoes, tipo_fornecedor, pasta, cnpj, consentimento_rede, user_id, token)
    SELECT f.nome, f.representante, f.telefone, f.email, f.pedido_minimo, f.prazo_pagamento,
           f.observacoes, f.tipo_fornecedor, f.pasta, f.cnpj, f.consentimento_rede, _uid,
           replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    FROM filtrados f
    RETURNING id
  ),
  vinculos AS (
    INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id)
    SELECT n.id, _loja_id FROM novos n RETURNING 1
  )
  SELECT COUNT(*)::int INTO _total FROM vinculos;
  RETURN COALESCE(_total, 0);
END;
$function$;

DROP FUNCTION IF EXISTS public.whatsapp_parceiro_existe(text);
CREATE FUNCTION public.whatsapp_parceiro_existe(_telefone text, _cnpj text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _cnpj_d text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _empresas jsonb;
  _mesma boolean := false;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN _fone := substr(_fone, 3); END IF;
  IF length(_fone) NOT IN (10, 11) THEN RETURN jsonb_build_object('existe', false); END IF;

  WITH r AS (
    SELECT DISTINCT ON (COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text)) f.nome, public.fornecedor_cnpj_key(f.cnpj) AS ck
    FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = right(_fone, 10)
      AND f.consentimento_rede = 'sim'
      AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')
    ORDER BY COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text), f.created_at DESC
  )
  SELECT jsonb_agg(r.nome ORDER BY r.nome), bool_or(length(_cnpj_d) = 14 AND r.ck = _cnpj_d)
  INTO _empresas, _mesma FROM r;

  IF _empresas IS NULL THEN RETURN jsonb_build_object('existe', false); END IF;
  RETURN jsonb_build_object('existe', true, 'nome', _empresas->>0, 'empresas', _empresas, 'mesma_empresa', COALESCE(_mesma, false));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.whatsapp_parceiro_existe(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cadastrar_fornecedor_parceiro(_nome text, _representante text, _telefone text, _cnpj text DEFAULT NULL::text, _tipo text DEFAULT NULL::text, _pastas text[] DEFAULT NULL::text[], _cidades jsonb DEFAULT NULL::jsonb, _convite_loja uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _fone_key text;
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _nome_clean text := btrim(COALESCE(_nome,''));
  _rep_clean text := btrim(COALESCE(_representante,''));
  _id uuid;
  _codigo text;
  _loja_id uuid;
  _loja_owner uuid;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN _fone := substr(_fone, 3); END IF;
  IF _nome_clean = '' THEN RAISE EXCEPTION 'Informe o nome da empresa'; END IF;
  IF length(_fone) NOT IN (10, 11) THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF length(_fone) = 11 AND substr(_fone, 3, 1) <> '9' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF substr(_fone, 1, 2)::int < 11 OR substr(_fone, 1, 2)::int > 99 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF _fone ~ '^(\d)\1+$' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF _cnpj_digits <> '' AND length(_cnpj_digits) <> 14 THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;

  _fone_key := right(_fone, 10);

  IF _convite_loja IS NOT NULL THEN
    SELECT l.id, l.user_id INTO _loja_id, _loja_owner FROM public.lojas l WHERE l.id = _convite_loja;
  END IF;

  -- Mesmo WhatsApp ja na Rede: exige CNPJ e barra so a mesma empresa
  IF EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
      AND f.consentimento_rede = 'sim'
      AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')
  ) THEN
    IF _cnpj_digits = '' THEN
      RETURN jsonb_build_object('status', 'cnpj_obrigatorio');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
        AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_digits
        AND f.consentimento_rede = 'sim'
        AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')
    ) THEN
      RETURN jsonb_build_object('status', 'ja_cadastrado');
    END IF;
  END IF;

  INSERT INTO public.fornecedores (
    nome, representante, telefone, cnpj, tipo_fornecedor, pasta,
    token, consentimento_rede, consentimento_ultima_pergunta, origem_cadastro, user_id, convite_loja_id
  ) VALUES (
    upper(_nome_clean), NULLIF(_rep_clean, ''), _fone, NULLIF(_cnpj_digits, ''),
    NULLIF(btrim(COALESCE(_tipo,'')), ''), _pastas,
    replace(gen_random_uuid()::text, '-', ''), 'sim', now(), 'autocadastro', _loja_owner, _loja_id
  ) RETURNING id INTO _id;

  IF _loja_id IS NOT NULL THEN
    INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id) VALUES (_id, _loja_id) ON CONFLICT DO NOTHING;
  END IF;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id, btrim(x->>'cidade'), NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''), public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x
    WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  _codigo := lpad((floor(random() * 10000))::int::text, 4, '0');
  INSERT INTO public.fornecedor_acessos (fornecedor_id, fone_key, codigo, finalidade, expira_em)
  VALUES (_id, _fone_key, _codigo, 'cadastro', now() + interval '7 days');

  RETURN jsonb_build_object('status', 'ok', 'codigo', _codigo, 'fornecedor_id', _id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_parceiro_dados(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.fornecedores;
BEGIN
  SELECT * INTO _row FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _row.id IS NULL THEN RETURN jsonb_build_object('encontrado', false); END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'nome', _row.nome,
    'representante', _row.representante,
    'telefone', _row.telefone,
    'cnpj', _row.cnpj,
    'tipo_fornecedor', _row.tipo_fornecedor,
    'pasta', to_jsonb(COALESCE(_row.pasta, ARRAY[]::text[])),
    'pedido_minimo', _row.pedido_minimo,
    'prazo_pagamento', _row.prazo_pagamento,
    'cidades', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', COALESCE(c.uf, '')) ORDER BY c.cidade)
      FROM public.fornecedor_cidades_atendidas c WHERE c.fornecedor_id = _row.id
    ), '[]'::jsonb),
    'outras_empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', x.nome, 'token', x.token) ORDER BY x.nome)
      FROM (
        SELECT DISTINCT ON (COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text)) f.nome, f.token
        FROM public.fornecedores f
        WHERE f.id <> _row.id
          AND public.fornecedor_fone_key(f.telefone) = public.fornecedor_fone_key(_row.telefone)
          AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '') <> COALESCE(public.fornecedor_cnpj_key(_row.cnpj), '#')
          AND f.consentimento_rede = 'sim'
          AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')
        ORDER BY COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text), f.created_at DESC
      ) x
    ), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parceiro_dados(text) TO anon, authenticated, service_role;