CREATE OR REPLACE FUNCTION public.admin_list_consentimentos(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, nome text, representante text, telefone text, email text,
  cnpj text, tipo_fornecedor text, pasta text[], origem_cadastro text,
  consentimento_rede text, consentimento_ultima_pergunta timestamp with time zone,
  consentimento_recusas integer, cadastros bigint, clientes bigint,
  lojas_vinculadas bigint, cidades text[], created_at timestamp with time zone,
  total_count bigint, total_sim bigint, total_nao bigint, total_pendente bigint
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
      public.fornecedor_fone_key(f.telefone) AS fone_key,
      public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
      btrim(regexp_replace(regexp_replace(
        lower(translate(f.nome,
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS nome_norm,
      btrim(regexp_replace(regexp_replace(
        lower(translate(COALESCE(f.representante, ''),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS rep_norm
    FROM public.fornecedores f
  ),
  chaveado AS (
    SELECT b.*,
      COALESCE('f:' || b.fone_key, 'c:' || b.cnpj_key,
               'n:' || b.nome_norm || '|' || b.rep_norm) AS grupo_key
    FROM base b
  ),
  ranqueado AS (
    SELECT c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.grupo_key
        ORDER BY
          CASE WHEN c.consentimento_rede = 'sim' THEN 0
               WHEN c.consentimento_rede = 'nao' THEN 1 ELSE 2 END,
          (c.cnpj_key IS NULL),
          c.created_at ASC
      ) AS rn
    FROM chaveado c
  ),
  agregado AS (
    SELECT
      r.grupo_key,
      COUNT(*) AS cadastros,
      COUNT(DISTINCT r.user_id) FILTER (WHERE r.user_id IS NOT NULL) AS clientes,
      COALESCE(SUM((SELECT COUNT(*) FROM public.fornecedor_lojas fl
                    WHERE fl.fornecedor_id = r.id)), 0) AS lojas_vinculadas,
      bool_or(r.consentimento_rede = 'sim') AS tem_sim,
      bool_or(r.consentimento_rede = 'nao') AS tem_nao,
      MAX(r.consentimento_ultima_pergunta) AS ultima_pergunta,
      MAX(r.consentimento_recusas) AS recusas,
      MAX(r.cnpj_key) AS cnpj_grupo,
      MIN(r.created_at) AS primeiro_cadastro
    FROM ranqueado r
    GROUP BY r.grupo_key
  ),
  mestre AS (
    SELECT r.*, ag.cadastros, ag.clientes, ag.lojas_vinculadas,
      ag.tem_sim, ag.tem_nao, ag.ultima_pergunta, ag.recusas,
      ag.cnpj_grupo, ag.primeiro_cadastro,
      CASE WHEN ag.tem_sim THEN 'sim'
           WHEN ag.tem_nao THEN 'nao'
           ELSE 'pendente' END AS status_grupo
    FROM ranqueado r
    JOIN agregado ag ON ag.grupo_key = r.grupo_key
    WHERE r.rn = 1
  ),
  comcidades AS (
    SELECT m.*,
      COALESCE((
        SELECT array_agg(DISTINCT cc.cidade ORDER BY cc.cidade)
        FROM public.fornecedor_cidades_atendidas cc
        JOIN chaveado c2 ON c2.id = cc.fornecedor_id
        WHERE c2.grupo_key = m.grupo_key
      ), ARRAY[]::text[]) AS cidades_grupo
    FROM mestre m
  ),
  filtrado AS (
    SELECT * FROM comcidades m
    WHERE (
      _search IS NULL OR btrim(_search) = ''
      OR m.nome ILIKE '%' || _search || '%'
      OR COALESCE(m.representante, '') ILIKE '%' || _search || '%'
      OR regexp_replace(COALESCE(m.telefone, ''), '\D', '', 'g')
         LIKE '%' || regexp_replace(_search, '\D', '', 'g') || '%'
         AND regexp_replace(_search, '\D', '', 'g') <> ''
      OR regexp_replace(COALESCE(m.cnpj, ''), '\D', '', 'g')
         LIKE '%' || regexp_replace(_search, '\D', '', 'g') || '%'
         AND regexp_replace(_search, '\D', '', 'g') <> ''
    )
    AND (
      _status IS NULL OR _status = 'todos' OR m.status_grupo = _status
    )
  ),
  totais AS (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE f.status_grupo = 'sim') AS total_sim,
      COUNT(*) FILTER (WHERE f.status_grupo = 'nao') AS total_nao,
      COUNT(*) FILTER (WHERE f.status_grupo = 'pendente') AS total_pendente
    FROM filtrado f
  )
  SELECT
    f.id, f.nome, f.representante, f.telefone, f.email,
    f.cnpj_grupo AS cnpj, f.tipo_fornecedor, f.pasta, f.origem_cadastro,
    f.status_grupo AS consentimento_rede,
    f.ultima_pergunta AS consentimento_ultima_pergunta,
    COALESCE(f.recusas, 0)::integer AS consentimento_recusas,
    f.cadastros, f.clientes, f.lojas_vinculadas,
    f.cidades_grupo AS cidades,
    f.primeiro_cadastro AS created_at,
    t.total_count, t.total_sim, t.total_nao, t.total_pendente
  FROM filtrado f CROSS JOIN totais t
  ORDER BY
    CASE f.status_grupo WHEN 'pendente' THEN 0 WHEN 'nao' THEN 1 ELSE 2 END,
    f.ultima_pergunta DESC NULLS LAST,
    f.nome ASC
  LIMIT COALESCE(_limit, 50) OFFSET COALESCE(_offset, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_consentimentos(text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_consentimentos(text, text, integer, integer) TO authenticated;