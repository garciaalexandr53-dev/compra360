REVOKE EXECUTE ON FUNCTION public.admin_list_fornecedores(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_fornecedor_detalhes(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text) FROM anon;