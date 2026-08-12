# Log de exclusão de cotações (auditoria)

Hoje, quando uma cotação é excluída, o registro desaparece do banco sem deixar rastro — não é possível saber depois se um cliente apagou cotações. O objetivo é passar a registrar toda exclusão, com quem apagou, quando e um resumo do que foi perdido.

## Como vai funcionar

- Toda exclusão de cotação passa a gravar automaticamente uma linha em um histórico de exclusões, com: nome da cotação, loja, status no momento da exclusão, data de criação, quantos produtos / fornecedores / preços / pedidos existiam, quem apagou e quando.
- O registro é gravado pelo próprio banco (gatilho), então funciona em qualquer caminho de exclusão que já existe hoje: Cotação ativa (descartar), Histórico (excluir uma ou em lote) e exclusão de cliente pelo admin.
- Nenhuma mudança no fluxo do cliente: continua excluindo do mesmo jeito, sem tela nova nem confirmação extra.
- No painel administrativo, ao abrir um cliente, aparece um bloco "Cotações excluídas" com a lista (nome, data de criação, data da exclusão, status e volumes). Se não houver nenhuma, o bloco não aparece.
- Registros antigos não podem ser recuperados — o log passa a valer das próximas exclusões em diante.

## Detalhes técnicos

1. Migração:
   - Nova tabela `public.cotacoes_excluidas` (colunas: `cotacao_id`, `nome`, `status`, `loja_id`, `loja_nome`, `created_by`, `cotacao_created_at`, `finalizada_at`, `total_produtos`, `total_fornecedores`, `total_precos`, `total_pedidos`, `deleted_by`, `deleted_at`).
   - GRANTs: `SELECT` para `authenticated`, `ALL` para `service_role` (o INSERT é feito pelo gatilho SECURITY DEFINER).
   - RLS habilitada: dono (`created_by = auth.uid()`) pode ler as próprias; admin (`is_admin()`) lê todas. Sem UPDATE/DELETE para ninguém (log imutável).
   - Função `public.log_cotacao_excluida()` SECURITY DEFINER, `SET search_path = public`, disparada por trigger `BEFORE DELETE ON public.cotacoes`, contabilizando os totais a partir de `cotacao_produtos`, `cotacao_fornecedores`, `precos` e `pedidos` antes do cascade.
   - Função `public.admin_list_cotacoes_excluidas(_user_id uuid)` SECURITY DEFINER com gate `is_admin()`, retornando o log do cliente ordenado por `deleted_at DESC`.

2. Frontend:
   - `src/components/admin/ClienteDetalhesSheet.tsx`: nova seção "Cotações excluídas" consumindo a RPC via TanStack Query, renderizada apenas quando há registros. Cards empilhados no mobile (360px) e linha compacta no desktop, seguindo o padrão visual atual do sheet.
   - Nenhuma alteração em `CotacaoPage.tsx`, `HistoricoPage.tsx` ou na Edge Function `admin-delete-user` — o gatilho cobre todos.
