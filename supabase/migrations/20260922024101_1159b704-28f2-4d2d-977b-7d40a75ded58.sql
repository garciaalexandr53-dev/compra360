CREATE TABLE public.fornecedor_acessos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  fone_key text NOT NULL,
  codigo text NOT NULL,
  finalidade text NOT NULL DEFAULT 'cadastro',
  expira_em timestamp with time zone NOT NULL DEFAULT (now() + interval '30 minutes'),
  confirmado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fornecedor_acessos TO authenticated;
GRANT ALL ON public.fornecedor_acessos TO service_role;

ALTER TABLE public.fornecedor_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver os codigos de acesso"
ON public.fornecedor_acessos FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX idx_fornecedor_acessos_fone ON public.fornecedor_acessos (fone_key, created_at DESC);
CREATE INDEX idx_fornecedor_acessos_fornecedor ON public.fornecedor_acessos (fornecedor_id, created_at DESC);

-- Gera um codigo de 4 digitos para o fornecedor confirmar a posse do WhatsApp
CREATE OR REPLACE FUNCTION public.gerar_codigo_acesso_parceiro(_fornecedor_id uuid, _fone text, _finalidade text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _codigo text := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
BEGIN
  INSERT INTO public.fornecedor_acessos (fornecedor_id, fone_key, codigo, finalidade)
  VALUES (_fornecedor_id, right(regexp_replace(COALESCE(_fone,''), '\D', '', 'g'), 10), _codigo, _finalidade);
  RETURN _codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_codigo_acesso_parceiro(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_acesso_parceiro(uuid, text, text) TO service_role;

-- Cadastro publico do parceiro: agora devolve o codigo de confirmacao
CREATE OR REPLACE FUNCTION public.cadastrar_fornecedor_parceiro(_nome text, _representante text, _telefone text, _cnpj text DEFAULT NULL::text, _tipo text DEFAULT NULL::text, _pastas text[] DEFAULT NULL::text[], _cidades jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _fone_key text;
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _nome_clean text := btrim(COALESCE(_nome,''));
  _rep_clean text := btrim(COALESCE(_representante,''));
  _id uuid;
  _status text;
  _token text;
  _codigo text;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN
    _fone := substr(_fone, 3);
  END IF;

  IF _nome_clean = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;
  IF length(_fone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF length(_fone) = 11 AND substr(_fone, 3, 1) <> '9' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF substr(_fone, 1, 2)::int < 11 OR substr(_fone, 1, 2)::int > 99 THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF _fone ~ '^(\d)\1+$' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF _cnpj_digits <> '' AND length(_cnpj_digits) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  _fone_key := right(_fone, 10);

  SELECT f.id INTO _id
  FROM public.fornecedores f
  WHERE right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 10) = _fone_key
    AND length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 10
  ORDER BY f.created_at DESC
  LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.fornecedores (
      nome, representante, telefone, cnpj, tipo_fornecedor, pasta,
      token, consentimento_rede, consentimento_ultima_pergunta, origem_cadastro
    ) VALUES (
      upper(_nome_clean),
      NULLIF(_rep_clean, ''),
      _fone,
      NULLIF(_cnpj_digits, ''),
      NULLIF(btrim(COALESCE(_tipo,'')), ''),
      _pastas,
      replace(gen_random_uuid()::text, '-', ''),
      'sim',
      now(),
      'autocadastro'
    )
    RETURNING id, token INTO _id, _token;
    _status := 'criado';
  ELSE
    UPDATE public.fornecedores f
      SET consentimento_rede = 'sim',
          consentimento_ultima_pergunta = now(),
          representante = COALESCE(NULLIF(_rep_clean,''), f.representante),
          cnpj = COALESCE(NULLIF(_cnpj_digits,''), f.cnpj),
          tipo_fornecedor = COALESCE(NULLIF(btrim(COALESCE(_tipo,'')),''), f.tipo_fornecedor),
          pasta = CASE
            WHEN _pastas IS NOT NULL AND array_length(_pastas,1) > 0 THEN _pastas
            ELSE f.pasta
          END,
          origem_cadastro = CASE
            WHEN f.origem_cadastro = 'cliente' THEN 'autocadastro'
            ELSE f.origem_cadastro
          END,
          updated_at = now()
    WHERE f.id = _id
    RETURNING f.token INTO _token;
    _status := 'atualizado';
  END IF;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id,
           btrim(x->>'cidade'),
           NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''),
           public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x
    WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  _codigo := public.gerar_codigo_acesso_parceiro(_id, _fone, 'cadastro');

  RETURN jsonb_build_object('status', _status, 'codigo', _codigo);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cadastrar_fornecedor_parceiro(text, text, text, text, text, text[], jsonb) TO anon, authenticated, service_role;

-- Parceiro ja cadastrado pede acesso informando o WhatsApp
CREATE OR REPLACE FUNCTION public.solicitar_acesso_parceiro(_telefone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _id uuid;
  _nome text;
  _codigo text;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN
    _fone := substr(_fone, 3);
  END IF;
  IF length(_fone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;

  SELECT f.id, f.nome INTO _id, _nome
  FROM public.fornecedores f
  WHERE right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 10) = right(_fone, 10)
    AND length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 10
  ORDER BY f.created_at DESC
  LIMIT 1;

  IF _id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  _codigo := public.gerar_codigo_acesso_parceiro(_id, _fone, 'edicao');
  RETURN jsonb_build_object('encontrado', true, 'nome', _nome, 'codigo', _codigo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_acesso_parceiro(text) TO anon, authenticated, service_role;

-- Dados do parceiro pelo link exclusivo dele
CREATE OR REPLACE FUNCTION public.get_parceiro_dados(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.fornecedores;
BEGIN
  SELECT * INTO _row FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

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
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parceiro_dados(text) TO anon, authenticated, service_role;

-- Parceiro atualiza os proprios dados pelo link exclusivo
CREATE OR REPLACE FUNCTION public.salvar_parceiro_dados(
  _token text,
  _nome text,
  _representante text,
  _tipo text DEFAULT NULL::text,
  _pastas text[] DEFAULT NULL::text[],
  _cidades jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;
  IF btrim(COALESCE(_nome,'')) = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;

  UPDATE public.fornecedores f
    SET nome = upper(btrim(_nome)),
        representante = NULLIF(btrim(COALESCE(_representante,'')), ''),
        tipo_fornecedor = NULLIF(btrim(COALESCE(_tipo,'')), ''),
        pasta = CASE WHEN _pastas IS NOT NULL THEN _pastas ELSE f.pasta END,
        consentimento_rede = 'sim',
        updated_at = now()
  WHERE f.id = _id;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    DELETE FROM public.fornecedor_cidades_atendidas c
    WHERE c.fornecedor_id = _id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_cidades) x
        WHERE public.norm_cidade(x->>'cidade') = c.cidade_norm
          AND COALESCE(NULLIF(upper(btrim(COALESCE(x->>'uf',''))),''), '') = COALESCE(c.uf, '')
      );

    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id,
           btrim(x->>'cidade'),
           NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''),
           public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x
    WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_parceiro_dados(text, text, text, text, text[], jsonb) TO anon, authenticated, service_role;

-- Admin confirma a posse do WhatsApp e recebe o link de acesso do parceiro
CREATE OR REPLACE FUNCTION public.admin_confirmar_parceiro(_fornecedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  UPDATE public.fornecedores
    SET origem_cadastro = 'autocadastro_confirmado',
        consentimento_rede = 'sim',
        updated_at = now()
  WHERE id = _fornecedor_id
  RETURNING token INTO _token;

  IF _token IS NULL THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;

  UPDATE public.fornecedor_acessos
    SET confirmado_em = now()
  WHERE fornecedor_id = _fornecedor_id AND confirmado_em IS NULL;

  RETURN jsonb_build_object('ok', true, 'token', _token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirmar_parceiro(uuid) TO authenticated, service_role;

-- Lista de fornecedores do admin: origem do cadastro e filtro de auto-cadastro
DROP FUNCTION IF EXISTS public.admin_list_fornecedores(text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.admin_list_fornecedores(_search text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _filtro text DEFAULT NULL::text)
RETURNS TABLE(id uuid, nome text, representante text, telefone text, email text, pedido_minimo numeric, prazo_pagamento text, created_at timestamp with time zone, user_id uuid, cliente_nome text, cliente_empresa text, cliente_email text, cidade text, uf text, lojas_vinculadas bigint, duplicado boolean, tipo_fornecedor text, pasta text[], origem_cadastro text, total_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      f.id, f.nome, f.representante, f.telefone, f.email,
      f.pedido_minimo, f.prazo_pagamento, f.created_at, f.user_id,
      f.tipo_fornecedor, f.pasta, f.origem_cadastro,
      btrim(regexp_replace(
        regexp_replace(
          lower(translate(f.nome,
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
          '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g')) AS nome_norm,
      btrim(regexp_replace(
        regexp_replace(
          lower(translate(COALESCE(f.representante, ''),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
          '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g')) AS rep_norm,
      (SELECT pr.nome FROM public.profiles pr
         WHERE pr.user_id = f.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
         LIMIT 1) AS cliente_nome,
      (SELECT l.nome FROM public.lojas l WHERE l.user_id = f.user_id
         ORDER BY l.created_at ASC LIMIT 1) AS cliente_empresa,
      (SELECT u.email::text FROM auth.users u WHERE u.id = f.user_id) AS cliente_email,
      (SELECT l.cidade FROM public.lojas l WHERE l.user_id = f.user_id AND l.cidade IS NOT NULL
         ORDER BY l.created_at ASC LIMIT 1) AS cidade,
      (SELECT l.uf FROM public.lojas l WHERE l.user_id = f.user_id AND l.uf IS NOT NULL
         ORDER BY l.created_at ASC LIMIT 1) AS uf,
      (SELECT COUNT(*) FROM public.fornecedor_lojas fl WHERE fl.fornecedor_id = f.id) AS lojas_vinculadas
    FROM public.fornecedores f
  ),
  fone AS (
    SELECT b.*,
      CASE
        WHEN length(regexp_replace(COALESCE(b.telefone, ''), '\D', '', 'g')) >= 12
          AND left(regexp_replace(COALESCE(b.telefone, ''), '\D', '', 'g'), 2) = '55'
          THEN right(regexp_replace(COALESCE(b.telefone, ''), '\D', '', 'g'), length(regexp_replace(COALESCE(b.telefone, ''), '\D', '', 'g')) - 2)
        ELSE regexp_replace(COALESCE(b.telefone, ''), '\D', '', 'g')
      END AS fone_digits
    FROM base b
  ),
  chaveado AS (
    SELECT fo.*,
      CASE WHEN length(fo.fone_digits) >= 10 THEN fo.fone_digits ELSE NULL END AS fone_key
    FROM fone fo
  ),
  marcado AS (
    SELECT c.*,
      CASE
        WHEN c.fone_key IS NOT NULL
          THEN (COUNT(*) OVER (PARTITION BY c.fone_key) > 1)
        ELSE (COUNT(*) OVER (PARTITION BY c.nome_norm, c.rep_norm) > 1)
      END AS duplicado
    FROM chaveado c
  ),
  filtrado AS (
    SELECT * FROM marcado m
    WHERE (
      _search IS NULL OR btrim(_search) = ''
      OR m.nome ILIKE '%' || _search || '%'
      OR COALESCE(m.representante, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.telefone, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.email, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.cliente_empresa, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.cliente_nome, '') ILIKE '%' || _search || '%'
    )
    AND (
      _filtro IS NULL OR _filtro = '' OR _filtro = 'todos'
      OR (_filtro = 'sem_whatsapp' AND COALESCE(btrim(m.telefone), '') = '')
      OR (_filtro = 'sem_email' AND COALESCE(btrim(m.email), '') = '')
      OR (_filtro = 'duplicados' AND m.duplicado)
      OR (_filtro = 'autocadastro' AND m.origem_cadastro IN ('autocadastro', 'autocadastro_confirmado'))
    )
  )
  SELECT
    fi.id, fi.nome, fi.representante, fi.telefone, fi.email,
    fi.pedido_minimo, fi.prazo_pagamento, fi.created_at, fi.user_id,
    fi.cliente_nome, fi.cliente_empresa, fi.cliente_email,
    fi.cidade, fi.uf, fi.lojas_vinculadas, fi.duplicado,
    fi.tipo_fornecedor, fi.pasta, fi.origem_cadastro,
    COUNT(*) OVER()::bigint AS total_count
  FROM filtrado fi
  ORDER BY fi.nome_norm ASC, fi.created_at ASC
  LIMIT _limit OFFSET _offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_fornecedores(text, integer, integer, text) TO authenticated, service_role;