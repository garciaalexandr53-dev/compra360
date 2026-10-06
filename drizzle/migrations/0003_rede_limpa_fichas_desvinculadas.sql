CREATE OR REPLACE FUNCTION public.desvincular_parceiro_empresa(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _row public.fornecedores;
  _fone_key text;
  _cnpj_key text;
  _nome text;
  _aviso text;
  _proximo jsonb;
  _tem_historico boolean;
BEGIN
  SELECT * INTO _row FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'link_invalido');
  END IF;

  _fone_key := public.fornecedor_fone_key(_row.telefone);
  _cnpj_key := public.fornecedor_cnpj_key(_row.cnpj);
  _nome := _row.nome;
  _aviso := '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
            || ' - o representante informou que nao atende mais esta empresa. Confirme um novo contato.]';

  SELECT jsonb_build_object('nome', f.nome, 'token', f.token) INTO _proximo
  FROM public.fornecedores f
  WHERE f.id <> _row.id
    AND f.user_id IS NULL
    AND public.fornecedor_fone_key(f.telefone) = _fone_key
    AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '') <> COALESCE(_cnpj_key, '#')
  ORDER BY f.created_at DESC
  LIMIT 1;

  _tem_historico := EXISTS (SELECT 1 FROM public.fornecedor_lojas WHERE fornecedor_id = _row.id)
    OR EXISTS (SELECT 1 FROM public.cotacao_fornecedores WHERE fornecedor_id = _row.id)
    OR EXISTS (SELECT 1 FROM public.pedidos WHERE fornecedor_id = _row.id)
    OR EXISTS (SELECT 1 FROM public.precos WHERE fornecedor_id = _row.id)
    OR EXISTS (SELECT 1 FROM public.historico_envios WHERE fornecedor_id = _row.id);

  IF _row.user_id IS NULL AND NOT _tem_historico THEN
    -- Ficha da Rede sem uso: remove por completo
    DELETE FROM public.fornecedor_acessos WHERE fornecedor_id = _row.id;
    DELETE FROM public.fornecedor_cidades_atendidas WHERE fornecedor_id = _row.id;
    DELETE FROM public.fornecedores WHERE id = _row.id;
  ELSE
    UPDATE public.fornecedores f
      SET consentimento_rede = 'nao',
          telefone = NULL,
          representante = NULL,
          token = encode(gen_random_bytes(16), 'hex'),
          observacoes = btrim(COALESCE(f.observacoes || E'\n', '') || _aviso),
          updated_at = now()
    WHERE f.id = _row.id
      AND f.user_id IS NULL;

    DELETE FROM public.fornecedor_acessos a
    WHERE a.fornecedor_id = _row.id AND a.confirmado_em IS NULL;
  END IF;

  UPDATE public.fornecedores f
    SET observacoes = btrim(COALESCE(f.observacoes || E'\n', '') || _aviso),
        updated_at = now()
  WHERE f.user_id IS NOT NULL
    AND public.fornecedor_fone_key(f.telefone) = _fone_key
    AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '#') = COALESCE(_cnpj_key, '#')
    AND COALESCE(f.observacoes, '') NOT LIKE '%nao atende mais esta empresa%';

  RETURN jsonb_build_object('ok', true, 'nome', _nome, 'proxima', _proximo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_rede_fornecedores(_search text DEFAULT NULL::text, _cidade text DEFAULT NULL::text, _uf text DEFAULT NULL::text, _tipo text DEFAULT NULL::text, _somente_rede boolean DEFAULT false, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nome text, representante text, telefone text, email text, pedido_minimo numeric, prazo_pagamento text, created_at timestamp with time zone, tipo_fornecedor text, pasta text[], origem_cadastro text, consentimento_rede text, cadastros bigint, clientes bigint, lojas_vinculadas bigint, cidades text[], clientes_nomes text[], na_rede boolean, total_count bigint)
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
      f.*,
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
    WHERE NOT (f.user_id IS NULL AND f.consentimento_rede = 'nao'
               AND COALESCE(btrim(f.telefone), '') = '')
  ),
  chaveado AS (
    SELECT b.*,
      CASE WHEN length(b.fone_digits) >= 10
        THEN 'f:' || b.fone_digits || '|' || COALESCE(public.fornecedor_cnpj_key(b.cnpj), '')
        ELSE 'n:' || b.nome_norm || '|' || b.rep_norm
      END AS grupo
    FROM base b
  ),
  grupos AS (
    SELECT
      c.grupo,
      array_agg(c.id) AS ids,
      (array_agg(c.id ORDER BY
        CASE WHEN c.origem_cadastro IN ('autocadastro','autocadastro_confirmado') THEN 0 ELSE 1 END,
        c.created_at ASC))[1] AS mestre_id,
      COUNT(*)::bigint AS cadastros,
      COUNT(DISTINCT c.user_id)::bigint AS clientes,
      min(c.created_at) AS created_at,
      bool_or(c.origem_cadastro IN ('autocadastro','autocadastro_confirmado')) AS na_rede,
      (array_agg(c.consentimento_rede ORDER BY
        CASE WHEN c.consentimento_rede = 'sim' THEN 0 ELSE 1 END, c.created_at ASC))[1] AS consentimento_rede
    FROM chaveado c
    GROUP BY c.grupo
  ),
  agrupado AS (
    SELECT
      g.mestre_id AS id, m.nome, m.representante, m.telefone, m.email,
      m.pedido_minimo, m.prazo_pagamento, g.created_at, m.tipo_fornecedor, m.pasta,
      m.origem_cadastro, g.consentimento_rede, g.cadastros, g.clientes,
      (SELECT COUNT(DISTINCT fl.loja_id)::bigint FROM public.fornecedor_lojas fl
         WHERE fl.fornecedor_id = ANY(g.ids)) AS lojas_vinculadas,
      COALESCE((SELECT array_agg(DISTINCT cc.cidade)
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(g.ids)), ARRAY[]::text[]) AS cidades,
      COALESCE((SELECT array_agg(DISTINCT x.nome)
          FROM (
            SELECT COALESCE(
              (SELECT l.nome FROM public.lojas l WHERE l.user_id = u.uid ORDER BY l.created_at ASC LIMIT 1),
              (SELECT pr.nome FROM public.profiles pr WHERE pr.user_id = u.uid LIMIT 1)
            ) AS nome
            FROM (SELECT DISTINCT c2.user_id AS uid FROM public.fornecedores c2
                   WHERE c2.id = ANY(g.ids) AND c2.user_id IS NOT NULL) u
          ) x WHERE x.nome IS NOT NULL), ARRAY[]::text[]) AS clientes_nomes,
      g.na_rede,
      COALESCE((SELECT array_agg(DISTINCT COALESCE(cc.uf, ''))
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(g.ids)), ARRAY[]::text[]) AS ufs,
      COALESCE((SELECT array_agg(DISTINCT cc.cidade_norm)
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(g.ids)), ARRAY[]::text[]) AS cidades_norm
    FROM grupos g
    JOIN public.fornecedores m ON m.id = g.mestre_id
  ),
  filtrado AS (
    SELECT a.* FROM agrupado a
    WHERE (
      _search IS NULL OR btrim(_search) = ''
      OR a.nome ILIKE '%' || _search || '%'
      OR COALESCE(a.representante, '') ILIKE '%' || _search || '%'
      OR COALESCE(a.telefone, '') ILIKE '%' || _search || '%'
      OR COALESCE(a.email, '') ILIKE '%' || _search || '%'
    )
    AND (_tipo IS NULL OR _tipo = '' OR _tipo = 'todos' OR a.tipo_fornecedor = _tipo)
    AND (NOT _somente_rede OR a.na_rede)
    AND (_cidade IS NULL OR btrim(_cidade) = '' OR public.norm_cidade(_cidade) = ANY(a.cidades_norm))
    AND (_uf IS NULL OR btrim(_uf) = '' OR upper(_uf) = ANY(a.ufs))
  )
  SELECT
    fi.id, fi.nome, fi.representante, fi.telefone, fi.email,
    fi.pedido_minimo, fi.prazo_pagamento, fi.created_at,
    fi.tipo_fornecedor, fi.pasta, fi.origem_cadastro, fi.consentimento_rede,
    fi.cadastros, fi.clientes, fi.lojas_vinculadas,
    fi.cidades, fi.clientes_nomes, fi.na_rede,
    (SELECT COUNT(*) FROM filtrado) AS total_count
  FROM filtrado fi
  ORDER BY fi.na_rede DESC, fi.nome ASC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END;
$function$;