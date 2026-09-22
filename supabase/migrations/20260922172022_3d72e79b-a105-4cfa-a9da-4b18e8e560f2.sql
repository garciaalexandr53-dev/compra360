REVOKE EXECUTE ON FUNCTION public.admin_list_rede_fornecedores(text, text, text, text, boolean, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_rede_filtros() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_rede_fornecedores(text, text, text, text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rede_filtros() TO authenticated;