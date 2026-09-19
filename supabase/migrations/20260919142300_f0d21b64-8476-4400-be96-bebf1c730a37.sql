CREATE OR REPLACE FUNCTION public.admin_list_fornecedores(_search text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _filtro text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nome text, representante text, telefone text, email text, pedido_minimo numeric, prazo_pagamento text, created_at timestamp with time zone, user_id uuid, cliente_nome text, cliente_empresa text, cliente_email text, cidade text, uf text, lojas_vinculadas bigint, duplicado boolean, tipo_fornecedor text, pasta text[], total_count bigint)
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
      f.tipo_fornecedor, f.pasta,
      btrim(regexp_replace(
        regexp_replace(
          lower(translate(f.nome,
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
            'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
          '[^a-z0-9]+', ' ', 'g'),
        '\s+', ' ', 'g')) AS nome_norm,
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
  marcado AS (
    SELECT b.*,
      (COUNT(*) OVER (PARTITION BY b.nome_norm) > 1) AS duplicado
    FROM base b
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
    )
  )
  SELECT
    fi.id, fi.nome, fi.representante, fi.telefone, fi.email,
    fi.pedido_minimo, fi.prazo_pagamento, fi.created_at, fi.user_id,
    fi.cliente_nome, fi.cliente_empresa, fi.cliente_email,
    fi.cidade, fi.uf, fi.lojas_vinculadas, fi.duplicado,
    fi.tipo_fornecedor, fi.pasta,
    COUNT(*) OVER()::bigint AS total_count
  FROM filtrado fi
  ORDER BY fi.nome_norm ASC, fi.created_at ASC
  LIMIT _limit OFFSET _offset;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_fornecedores(text, integer, integer, text) FROM anon;