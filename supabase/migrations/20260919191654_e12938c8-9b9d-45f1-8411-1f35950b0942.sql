REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) TO authenticated;