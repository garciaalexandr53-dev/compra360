REVOKE EXECUTE ON FUNCTION public.admin_registrar_pagamento_manual(uuid, text, text, timestamp with time zone, text, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_pagamentos_manuais(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_assinaturas_manuais() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_registrar_pagamento_manual(uuid, text, text, timestamp with time zone, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_pagamentos_manuais(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_assinaturas_manuais() TO authenticated, service_role;