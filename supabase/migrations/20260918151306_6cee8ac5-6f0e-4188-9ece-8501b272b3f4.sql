alter table public.fornecedores
  add column tipo_fornecedor text
    check (tipo_fornecedor in ('geral', 'bebidas', 'especializado')),
  add column pasta text[];