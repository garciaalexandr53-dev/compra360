
-- Admin RPC: list deduplicated email logs with filters
CREATE OR REPLACE FUNCTION public.admin_list_email_logs(
  _start timestamptz DEFAULT (now() - interval '7 days'),
  _end timestamptz DEFAULT now(),
  _template text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit int DEFAULT 100,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  message_id text,
  template_name text,
  recipient_email text,
  status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (COALESCE(l.message_id, l.id::text))
      l.id, l.message_id, l.template_name, l.recipient_email,
      l.status, l.error_message, l.metadata, l.created_at
    FROM public.email_send_log l
    ORDER BY COALESCE(l.message_id, l.id::text), l.created_at DESC
  ),
  filtered AS (
    SELECT * FROM latest
    WHERE created_at >= _start
      AND created_at <= _end
      AND (_template IS NULL OR template_name = _template)
      AND (_status IS NULL OR status = _status)
  )
  SELECT f.id, f.message_id, f.template_name, f.recipient_email,
         f.status, f.error_message, f.metadata, f.created_at,
         COUNT(*) OVER()::bigint AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- Admin RPC: summary stats for active filter window
CREATE OR REPLACE FUNCTION public.admin_email_stats(
  _start timestamptz DEFAULT (now() - interval '7 days'),
  _end timestamptz DEFAULT now(),
  _template text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (COALESCE(l.message_id, l.id::text))
      l.status, l.template_name, l.created_at
    FROM public.email_send_log l
    ORDER BY COALESCE(l.message_id, l.id::text), l.created_at DESC
  ),
  filtered AS (
    SELECT * FROM latest
    WHERE created_at >= _start
      AND created_at <= _end
      AND (_template IS NULL OR template_name = _template)
  )
  SELECT jsonb_build_object(
    'total',      COUNT(*),
    'sent',       COUNT(*) FILTER (WHERE status = 'sent'),
    'pending',    COUNT(*) FILTER (WHERE status = 'pending'),
    'failed',     COUNT(*) FILTER (WHERE status IN ('failed','dlq','bounced')),
    'suppressed', COUNT(*) FILTER (WHERE status = 'suppressed'),
    'complained', COUNT(*) FILTER (WHERE status = 'complained')
  ) INTO result
  FROM filtered;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Admin RPC: distinct template names for filter dropdown
CREATE OR REPLACE FUNCTION public.admin_email_template_names()
RETURNS TABLE (template_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
    SELECT DISTINCT l.template_name
    FROM public.email_send_log l
    ORDER BY l.template_name;
END;
$$;
