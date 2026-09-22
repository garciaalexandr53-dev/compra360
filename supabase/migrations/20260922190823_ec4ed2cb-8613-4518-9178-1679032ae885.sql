CREATE OR REPLACE FUNCTION public.admin_list_duplicados(_search text DEFAULT NULL, _limit integer DEFAULT 30, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  nome text,
  representante text,
  telefone text,
  email text,
  created_at timestamp with time zone,
  user_id uuid,
  cliente_nome text,
  cliente_empresa text,
  cidade text,
  uf text,
  origem_cadastro text,
  tipo_fornecedor text,
  lojas_vinculadas bigint,
  total_relacionamentos bigint,
  grupo_key text,
  grupo_tipo text,
  mestre_sugerido boolean,
  total_grupos bigint,
  total_count bigint
)
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
      f.id, f.nome, f.representante, f.telefone, f.email, f.created_at, f.user_id,
      f.origem_cadastro, f.tipo_fornecedor,
      btrim(regexp_replace(regexp_replace(
        lower(translate(f.nome,
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS nome_norm,
      btrim(regexp_replace(regexp_replace(
        lower(translate(COALESCE(f.representante, ''),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS rep_norm,
      CASE
        WHEN length(regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g')) >= 12
          AND left(regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g'), 2) = '55'
          THEN right(regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g'),
                     length(regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g')) - 2)
        ELSE regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g')
      END AS fone_digits
    FROM public.fornecedores f
  ),
  chaveado AS (
    SELECT b.*,
      CASE
        WHEN length(b.fone_digits) >= 10 THEN 'f:' || b.fone_digits
        WHEN b.nome_norm <> '' THEN 'n:' || b.nome_norm || '|' || b.rep_norm
        ELSE NULL
      END AS grupo_key,
      CASE
        WHEN length(b.fone_digits) >= 10 THEN 'whatsapp'
        ELSE 'nome'
      END AS grupo_tipo
    FROM base b
  ),
  grupos AS (
    SELECT c.grupo_key,
      (array_agg(c.id ORDER BY
        CASE WHEN c.origem_cadastro IN ('autocadastro','autocadastro_confirmado') THEN 0 ELSE 1 END,
        c.created_at ASC))[1] AS mestre_id,
      COUNT(*)::bigint AS cadastros
    FROM chaveado c
    WHERE c.grupo_key IS NOT NULL
    GROUP BY c.grupo_key
    HAVING COUNT(*) > 1
  ),
  filtrado_grupos AS (
    SELECT g.* FROM grupos g
    WHERE EXISTS (
      SELECT 1
      FROM chaveado c
      JOIN public.fornecedores f2 ON f2.id = c.id
      LEFT JOIN public.lojas l2 ON l2.user_id = c.user_id
      LEFT JOIN public.profiles p2 ON p2.user_id = c.user_id
      WHERE c.grupo_key = g.grupo_key
      AND (
        _search IS NULL OR btrim(_search) = ''
        OR f2.nome ILIKE '%' || _search || '%'
        OR COALESCE(f2.representante, '') ILIKE '%' || _search || '%'
        OR COALESCE(f2.telefone, '') ILIKE '%' || _search || '%'
        OR COALESCE(f2.email, '') ILIKE '%' || _search || '%'
        OR COALESCE(l2.nome, '') ILIKE '%' || _search || '%'
        OR COALESCE(p2.nome, '') ILIKE '%' || _search || '%'
      )
    )
  ),
  paginado AS (
    SELECT * FROM filtrado_grupos
    ORDER BY grupo_key
    LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0)
  ),
  registros AS (
    SELECT
      c.id, c.nome, c.representante, c.telefone, c.email, c.created_at, c.user_id,
      c.origem_cadastro, c.tipo_fornecedor, c.grupo_key, c.grupo_tipo,
      (SELECT pr.nome FROM public.profiles pr
         WHERE pr.user_id = c.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
         LIMIT 1) AS cliente_nome,
      (SELECT l.nome FROM public.lojas l WHERE l.user_id = c.user_id
         ORDER BY l.created_at ASC LIMIT 1) AS cliente_empresa,
      (SELECT l.cidade FROM public.lojas l WHERE l.user_id = c.user_id
         AND l.cidade IS NOT NULL ORDER BY l.created_at ASC LIMIT 1) AS cidade,
      (SELECT l.uf FROM public.lojas l WHERE l.user_id = c.user_id
         AND l.uf IS NOT NULL ORDER BY l.created_at ASC LIMIT 1) AS uf,
      (SELECT COUNT(*)::bigint FROM public.fornecedor_lojas fl WHERE fl.fornecedor_id = c.id) AS lojas_vinculadas,
      ((
        SELECT COUNT(*)::bigint FROM public.fornecedor_lojas fl WHERE fl.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.fornecedor_cidades_atendidas cc WHERE cc.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.cotacao_fornecedores cf WHERE cf.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.precos pc WHERE pc.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.pedidos pd WHERE pd.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.historico_envios he WHERE he.fornecedor_id = c.id
      ) + (
        SELECT COUNT(*)::bigint FROM public.fornecedor_acessos fa WHERE fa.fornecedor_id = c.id
      )) AS total_relacionamentos,
      (p.mestre_id = c.id) AS mestre_sugerido
    FROM chaveado c
    JOIN paginado p ON p.grupo_key = c.grupo_key
  )
  SELECT
    r.id, r.nome, r.representante, r.telefone, r.email, r.created_at, r.user_id,
    r.cliente_nome, r.cliente_empresa, r.cidade, r.uf,
    r.origem_cadastro, r.tipo_fornecedor, r.lojas_vinculadas, r.total_relacionamentos,
    r.grupo_key, r.grupo_tipo, r.mestre_sugerido,
    (SELECT COUNT(*)::bigint FROM filtrado_grupos) AS total_grupos,
    (SELECT COUNT(*)::bigint FROM chaveado c2 JOIN filtrado_grupos fg2 ON fg2.grupo_key = c2.grupo_key) AS total_count
  FROM registros r
  ORDER BY r.grupo_key, (r.mestre_sugerido) DESC, r.created_at ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_duplicados(text, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_duplicados(text, integer, integer) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.admin_unificar_fornecedor(_mestre_id uuid, _sobressalente_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sobr uuid;
  _movidos bigint := 0;
  _removidos int := 0;
  _n bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _mestre_id IS NULL THEN
    RAISE EXCEPTION 'Informe o cadastro principal (mestre).';
  END IF;

  IF _sobressalente_ids IS NULL OR array_length(_sobressalente_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um cadastro a unificar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = _mestre_id) THEN
    RAISE EXCEPTION 'Cadastro principal não encontrado.';
  END IF;

  FOREACH _sobr IN ARRAY _sobressalente_ids
  LOOP
    IF _sobr = _mestre_id THEN
      RAISE EXCEPTION 'O cadastro principal não pode ser unificado a si mesmo.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = _sobr) THEN
      CONTINUE;
    END IF;

    -- 1) Preencher campos nulos do mestre com os dados do sobressalente
    UPDATE public.fornecedores m
    SET
      telefone = COALESCE(m.telefone, s.telefone),
      email = COALESCE(m.email, s.email),
      representante = COALESCE(m.representante, s.representante),
      observacoes = COALESCE(NULLIF(btrim(m.observacoes), ''), s.observacoes),
      pedido_minimo = COALESCE(NULLIF(m.pedido_minimo, 0), s.pedido_minimo),
      prazo_pagamento = COALESCE(NULLIF(btrim(m.prazo_pagamento), ''), s.prazo_pagamento),
      tipo_fornecedor = COALESCE(NULLIF(btrim(m.tipo_fornecedor), ''), s.tipo_fornecedor),
      cnpj = COALESCE(NULLIF(btrim(m.cnpj), ''), s.cnpj),
      pasta = CASE WHEN m.pasta IS NULL OR array_length(m.pasta, 1) IS NULL THEN s.pasta ELSE m.pasta END,
      consentimento_rede = CASE
        WHEN m.consentimento_rede = 'sim' THEN 'sim'
        WHEN s.consentimento_rede = 'sim' THEN 'sim'
        ELSE m.consentimento_rede END,
      updated_at = now()
    FROM (SELECT * FROM public.fornecedores WHERE id = _sobr) s
    WHERE m.id = _mestre_id;

    -- 2) Lojas vinculadas (ignora quando o mestre já está na loja)
    WITH mov AS (
      UPDATE public.fornecedor_lojas fl
      SET fornecedor_id = _mestre_id
      WHERE fl.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.fornecedor_lojas fl2
        WHERE fl2.fornecedor_id = _mestre_id AND fl2.loja_id = fl.loja_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 3) Cidades atendidas (ignora duplicidade de cidade/UF)
    WITH mov AS (
      UPDATE public.fornecedor_cidades_atendidas cc
      SET fornecedor_id = _mestre_id
      WHERE cc.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.fornecedor_cidades_atendidas cc2
        WHERE cc2.fornecedor_id = _mestre_id
          AND cc2.cidade_norm = cc.cidade_norm
          AND COALESCE(cc2.uf, '') = COALESCE(cc.uf, '')
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 4) Cotações do fornecedor (ignora quando o mestre já está na cotação)
    WITH mov AS (
      UPDATE public.cotacao_fornecedores cf
      SET fornecedor_id = _mestre_id
      WHERE cf.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.cotacao_fornecedores cf2
        WHERE cf2.fornecedor_id = _mestre_id AND cf2.cotacao_id = cf.cotacao_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 5) Preços (ignora quando o mestre já respondeu aquele item)
    WITH mov AS (
      UPDATE public.precos pc
      SET fornecedor_id = _mestre_id
      WHERE pc.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.precos pc2
        WHERE pc2.fornecedor_id = _mestre_id AND pc2.cotacao_produto_id = pc.cotacao_produto_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 6) Pedidos (sem restrição de unicidade)
    WITH mov AS (
      UPDATE public.pedidos pd
      SET fornecedor_id = _mestre_id
      WHERE pd.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 7) Histórico de envios
    WITH mov AS (
      UPDATE public.historico_envios he
      SET fornecedor_id = _mestre_id
      WHERE he.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 8) Acessos do fornecedor
    WITH mov AS (
      UPDATE public.fornecedor_acessos fa
      SET fornecedor_id = _mestre_id
      WHERE fa.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    -- 9) Remover o cadastro sobressalente (sobras conflitantes caem em cascata)
    DELETE FROM public.fornecedores WHERE id = _sobr;
    _removidos := _removidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'mestre_id', _mestre_id,
    'unificados', _removidos,
    'relacionamentos_movidos', _movidos
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_unificar_fornecedor(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_unificar_fornecedor(uuid, uuid[]) TO authenticated, service_role;