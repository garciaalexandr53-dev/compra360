-- 1) Cidades agregadas de todas as fichas do mesmo WhatsApp
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
      AND f.consentimento_rede = 'sim'
      AND (f.user_id IS NULL OR f.origem_cadastro LIKE 'autocadastro%')
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

  IF length(_cnpj_d) = 14 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.fornecedores f
      WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
        AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_d
        AND f.consentimento_rede = 'sim'
        AND (f.user_id IS NULL OR f.origem_cadastro LIKE 'autocadastro%')
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

  IF _ficha.id IS NULL THEN
    RETURN jsonb_build_object('existe', COALESCE(_empresas IS NOT NULL, false),
                              'empresas', COALESCE(_empresas, '[]'::jsonb),
                              'mesma_empresa', COALESCE(_mesma, false));
  END IF;

  -- Cidades de TODAS as fichas do mesmo WhatsApp (e, quando houver CNPJ na ficha, do mesmo CNPJ)
  WITH fichas AS (
    SELECT f.id
    FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
      AND (public.fornecedor_cnpj_key(_ficha.cnpj) IS NULL
           OR public.fornecedor_cnpj_key(f.cnpj) IS NULL
           OR public.fornecedor_cnpj_key(f.cnpj) = public.fornecedor_cnpj_key(_ficha.cnpj))
  ), cid AS (
    SELECT DISTINCT c.cidade, COALESCE(c.uf, '') AS uf
    FROM public.fornecedor_cidades_atendidas c
    JOIN fichas fi ON fi.id = c.fornecedor_id
  )
  SELECT jsonb_agg(jsonb_build_object('cidade', cidade, 'uf', uf) ORDER BY cidade)
  INTO _cidades FROM cid;

  SELECT EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
      AND f.consentimento_rede = 'sim'
      AND (f.user_id IS NULL OR f.origem_cadastro LIKE 'autocadastro%')
      AND (public.fornecedor_cnpj_key(f.cnpj) IS NOT DISTINCT FROM public.fornecedor_cnpj_key(_ficha.cnpj)
           OR upper(btrim(f.nome)) = upper(btrim(_ficha.nome)))
  ) INTO _na_rede;

  RETURN jsonb_build_object(
    'existe', true,
    'nome', COALESCE(_empresas->>0, _ficha.nome),
    'empresas', COALESCE(_empresas, '[]'::jsonb),
    'mesma_empresa', COALESCE(_mesma, false),
    'ficha', jsonb_build_object(
      'nome', _ficha.nome,
      'representante', _ficha.representante,
      'cnpj', _ficha.cnpj,
      'tipo_fornecedor', _ficha.tipo_fornecedor,
      'pasta', to_jsonb(COALESCE(_ficha.pasta, ARRAY[]::text[])),
      'cidades', COALESCE(_cidades, '[]'::jsonb),
      'na_rede', COALESCE(_na_rede, false)
    )
  );
END;
$function$;

-- 2) Codigo de seguranca por WhatsApp (nao apenas pela ficha aberta)
CREATE OR REPLACE FUNCTION public.admin_get_fornecedor_detalhes(_fornecedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'representante', f.representante,
    'telefone', f.telefone,
    'email', f.email,
    'pedido_minimo', f.pedido_minimo,
    'prazo_pagamento', f.prazo_pagamento,
    'observacoes', f.observacoes,
    'tipo_fornecedor', f.tipo_fornecedor,
    'pasta', COALESCE(to_jsonb(f.pasta), '[]'::jsonb),
    'cnpj', f.cnpj,
    'token', f.token,
    'origem_cadastro', f.origem_cadastro,
    'consentimento_rede', f.consentimento_rede,
    'consentimento_ultima_pergunta', f.consentimento_ultima_pergunta,
    'consentimento_tentativas_skip', f.consentimento_tentativas_skip,
    'consentimento_recusas', f.consentimento_recusas,
    'cidades_atendidas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', c.uf) ORDER BY c.cidade)
      FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = f.id
    ), '[]'::jsonb),
    'codigo_verificacao', COALESCE(
      (SELECT a.codigo FROM public.fornecedor_acessos a
        WHERE public.fornecedor_fone_key(a.fone_key) IS NOT NULL
          AND public.fornecedor_fone_key(a.fone_key) = public.fornecedor_fone_key(f.telefone)
        ORDER BY a.created_at DESC LIMIT 1),
      (SELECT a.codigo FROM public.fornecedor_acessos a
        WHERE a.fornecedor_id = f.id
        ORDER BY a.created_at DESC LIMIT 1)
    ),
    'created_at', f.created_at,
    'user_id', f.user_id,
    'cliente_nome', (SELECT pr.nome FROM public.profiles pr
                       WHERE pr.user_id = f.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
                       LIMIT 1),
    'cliente_email', (SELECT u.email::text FROM auth.users u WHERE u.id = f.user_id),
    'cliente_empresa', (SELECT l.nome FROM public.lojas l WHERE l.user_id = f.user_id
                          ORDER BY l.created_at ASC LIMIT 1),
    'lojas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cidade', l.cidade, 'uf', l.uf)
                       ORDER BY l.nome)
      FROM public.fornecedor_lojas fl
      JOIN public.lojas l ON l.id = fl.loja_id
      WHERE fl.fornecedor_id = f.id
    ), '[]'::jsonb),
    'cotacoes_recebidas', (SELECT COUNT(*) FROM public.cotacao_fornecedores cf WHERE cf.fornecedor_id = f.id),
    'cotacoes_respondidas', (
      SELECT COUNT(DISTINCT cp.cotacao_id)
      FROM public.precos p
      JOIN public.cotacao_produtos cp ON cp.id = p.cotacao_produto_id
      WHERE p.fornecedor_id = f.id
    ),
    'ultima_resposta_at', (
      SELECT MAX(p.updated_at) FROM public.precos p WHERE p.fornecedor_id = f.id
    )
  ) INTO result
  FROM public.fornecedores f
  WHERE f.id = _fornecedor_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

-- 3) Lista de solicitacoes de acesso recentes para o painel
CREATE OR REPLACE FUNCTION public.admin_list_solicitacoes_acesso(_dias integer DEFAULT 30, _limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  fornecedor_id uuid,
  nome text,
  representante text,
  telefone text,
  cnpj text,
  token text,
  codigo text,
  finalidade text,
  expira_em timestamptz,
  confirmado_em timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.fornecedor_id, f.nome, f.representante, f.telefone, f.cnpj, f.token,
         a.codigo, a.finalidade, a.expira_em, a.confirmado_em, a.created_at
  FROM public.fornecedor_acessos a
  JOIN public.fornecedores f ON f.id = a.fornecedor_id
  WHERE public.is_admin()
    AND a.created_at >= now() - make_interval(days => GREATEST(COALESCE(_dias, 30), 1))
  ORDER BY a.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 100), 500)
$$;

REVOKE ALL ON FUNCTION public.admin_list_solicitacoes_acesso(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_solicitacoes_acesso(integer, integer) TO authenticated;