CREATE OR REPLACE FUNCTION public.admin_list_rede_fornecedores(
  _search text DEFAULT NULL,
  _cidade text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _tipo text DEFAULT NULL,
  _somente_rede boolean DEFAULT false,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, nome text, representante text, telefone text, email text,
  pedido_minimo numeric, prazo_pagamento text, created_at timestamp with time zone,
  tipo_fornecedor text, pasta text[], origem_cadastro text, consentimento_rede text,
  cadastros bigint, clientes bigint, lojas_vinculadas bigint,
  cidades text[], clientes_nomes text[], na_rede boolean, total_count bigint
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
  agrupado AS (
    SELECT
      c.grupo,
      (array_agg(c.id ORDER BY
        CASE WHEN c.origem_cadastro IN ('autocadastro','autocadastro_confirmado') THEN 0 ELSE 1 END,
        c.created_at ASC))[1] AS id,
      (array_agg(c.nome ORDER BY c.created_at ASC))[1] AS nome,
      (array_agg(c.representante ORDER BY (c.representante IS NULL), c.created_at ASC))[1] AS representante,
      (array_agg(c.telefone ORDER BY (c.telefone IS NULL), c.created_at ASC))[1] AS telefone,
      (array_agg(c.email ORDER BY (c.email IS NULL), c.created_at ASC))[1] AS email,
      (array_agg(c.pedido_minimo ORDER BY (c.pedido_minimo IS NULL), c.created_at ASC))[1] AS pedido_minimo,
      (array_agg(c.prazo_pagamento ORDER BY (c.prazo_pagamento IS NULL), c.created_at ASC))[1] AS prazo_pagamento,
      min(c.created_at) AS created_at,
      (array_agg(c.tipo_fornecedor ORDER BY (c.tipo_fornecedor IS NULL), c.created_at ASC))[1] AS tipo_fornecedor,
      (array_agg(c.pasta ORDER BY (c.pasta IS NULL), c.created_at ASC))[1] AS pasta,
      (array_agg(c.origem_cadastro ORDER BY
        CASE WHEN c.origem_cadastro IN ('autocadastro','autocadastro_confirmado') THEN 0 ELSE 1 END,
        c.created_at ASC))[1] AS origem_cadastro,
      (array_agg(c.consentimento_rede ORDER BY
        CASE WHEN c.consentimento_rede = 'sim' THEN 0 ELSE 1 END, c.created_at ASC))[1] AS consentimento_rede,
      COUNT(*) AS cadastros,
      COUNT(DISTINCT c.user_id) AS clientes,
      (SELECT COUNT(DISTINCT fl.loja_id) FROM public.fornecedor_lojas fl
         WHERE fl.fornecedor_id = ANY(array_agg(c.id))) AS lojas_vinculadas,
      COALESCE((SELECT array_agg(DISTINCT cc.cidade ORDER BY cc.cidade)
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(array_agg(c.id))), ARRAY[]::text[]) AS cidades,
      COALESCE((SELECT array_agg(DISTINCT x.nome)
          FROM (
            SELECT COALESCE(
              (SELECT l.nome FROM public.lojas l WHERE l.user_id = u.uid ORDER BY l.created_at ASC LIMIT 1),
              (SELECT pr.nome FROM public.profiles pr WHERE pr.user_id = u.uid LIMIT 1)
            ) AS nome
            FROM (SELECT DISTINCT c2.user_id AS uid FROM public.fornecedores c2
                   WHERE c2.id = ANY(array_agg(c.id)) AND c2.user_id IS NOT NULL) u
          ) x WHERE x.nome IS NOT NULL), ARRAY[]::text[]) AS clientes_nomes,
      bool_or(c.origem_cadastro IN ('autocadastro','autocadastro_confirmado')) AS na_rede,
      COALESCE((SELECT array_agg(DISTINCT COALESCE(cc.uf, ''))
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(array_agg(c.id))), ARRAY[]::text[]) AS ufs,
      COALESCE((SELECT array_agg(DISTINCT cc.cidade_norm)
          FROM public.fornecedor_cidades_atendidas cc
          WHERE cc.fornecedor_id = ANY(array_agg(c.id))), ARRAY[]::text[]) AS cidades_norm
    FROM chaveado c
    GROUP BY c.grupo
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

CREATE OR REPLACE FUNCTION public.admin_rede_filtros()
RETURNS TABLE(cidade text, uf text, fornecedores bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT cc.cidade, COALESCE(cc.uf, '') AS uf, COUNT(DISTINCT cc.fornecedor_id) AS fornecedores
  FROM public.fornecedor_cidades_atendidas cc
  GROUP BY cc.cidade, COALESCE(cc.uf, '')
  ORDER BY cc.cidade ASC;
END;
$function$;