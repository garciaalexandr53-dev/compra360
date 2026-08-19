CREATE OR REPLACE FUNCTION public.admin_list_pagamentos_manuais(_user_id uuid)
RETURNS TABLE(
  id uuid,
  valor numeric,
  metodo text,
  ciclo text,
  periodo_inicio timestamp with time zone,
  periodo_fim timestamp with time zone,
  observacao text,
  plan_name text,
  created_at timestamp with time zone
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
    SELECT pm.id, pm.valor, pm.metodo, pm.ciclo, pm.periodo_inicio, pm.periodo_fim,
           pm.observacao, p.name::text, pm.created_at
    FROM public.pagamentos_manuais pm
    JOIN public.plans p ON p.id = pm.plan_id
    WHERE pm.user_id = _user_id
    ORDER BY pm.created_at DESC
    LIMIT 50;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_pagamentos_manuais(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pagamentos_manuais(uuid) TO authenticated, service_role;