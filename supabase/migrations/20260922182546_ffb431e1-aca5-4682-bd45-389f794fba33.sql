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
  ),
  chaveado AS (
    SELECT b.*,
      CASE WHEN length(b.fone_digits) >= 10
        THEN 'f:' || b.fone_digits
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
      g.mestre_id AS id,
      m.nome,
      m.representante,
      m.telefone,
      m.email,
      m.pedido_minimo,
      m.prazo_pagamento,
      g.created_at,
      m.tipo_fornecedor,
      m.pasta,
      m.origem_cadastro,
      g.consentimento_rede,
      g.cadastros,
      g.clientes,
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
    AND (
      _cidade IS NULL OR btrim(_cidade) = ''
      OR public.norm_cidade(_cidade) = ANY(a.cidades_norm)
    )
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