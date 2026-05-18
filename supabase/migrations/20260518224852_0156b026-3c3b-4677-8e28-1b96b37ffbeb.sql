CREATE OR REPLACE FUNCTION public.admin_list_contatos(
  _user_id uuid DEFAULT NULL,
  _canal text DEFAULT NULL,
  _motivo text DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  canal text,
  motivo text,
  observacao text,
  created_at timestamptz,
  cliente_nome text,
  cliente_email text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      c.id, c.user_id, c.canal, c.motivo, c.observacao, c.created_at,
      (SELECT l.nome FROM public.lojas l WHERE l.user_id = c.user_id ORDER BY l.created_at ASC LIMIT 1) AS cliente_nome,
      u.email::text AS cliente_email
    FROM public.admin_contatos c
    LEFT JOIN auth.users u ON u.id = c.user_id
  ),
  filtered AS (
    SELECT * FROM base b
    WHERE (_user_id IS NULL OR b.user_id = _user_id)
      AND (_canal IS NULL OR b.canal = _canal)
      AND (_motivo IS NULL OR b.motivo = _motivo)
      AND (
        _search IS NULL OR _search = '' OR
        COALESCE(b.cliente_nome,'') ILIKE '%' || _search || '%' OR
        COALESCE(b.cliente_email,'') ILIKE '%' || _search || '%' OR
        COALESCE(b.observacao,'') ILIKE '%' || _search || '%'
      )
  )
  SELECT f.id, f.user_id, f.canal, f.motivo, f.observacao, f.created_at,
         f.cliente_nome, f.cliente_email,
         COUNT(*) OVER()::bigint AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;