# Aba Fornecedores no Painel Admin

Nova seção "Fornecedores" no `/admin`, consolidando todos os fornecedores cadastrados por todos os supermercados clientes, com busca, filtros, edição de contato e exportação.

## O que o administrador verá

- Lista de todos os fornecedores da base (hoje 84 cadastros / 12 clientes), 50 por página.
- Busca única por nome do fornecedor, representante, telefone ou e-mail.
- Filtros rápidos: Todos · Sem WhatsApp · Sem e-mail · Duplicados (mesmo nome normalizado em clientes diferentes).
- Cada linha/card mostra: fornecedor, representante, telefone, e-mail, pedido mínimo, prazo de pagamento, supermercado dono do cadastro, cidade/UF da loja e data de cadastro.
- Contador de resultados e indicador de carregamento, no mesmo padrão da aba Catálogo.
- Desktop: tabela; mobile (360px): cards empilhados com nome em destaque e dados em linhas secundárias.

## Ficha do fornecedor

Abre em painel lateral (desktop) / bottom sheet (mobile) com:

- Dados do cadastro: nome, representante, telefone, e-mail, pedido mínimo, prazo de pagamento, observações.
- Cliente dono do cadastro (nome do responsável + empresa) e lojas vinculadas.
- Atividade: quantas cotações recebeu, quantas respondeu e data da última resposta.
- Ações: abrir WhatsApp com o representante; corrigir dados de contato (nome, representante, telefone, e-mail, prazo, pedido mínimo, observações) quando o cliente informar mudança de representante ou número.
- Nada é excluído por aqui — o administrador apenas corrige dados.

## Exportação

Botão "Exportar" gera Excel com todos os fornecedores do filtro atual (colunas: fornecedor, representante, telefone, e-mail, pedido mínimo, prazo, cliente, empresa, cidade/UF, cadastrado em), no mesmo padrão dos exports de Clientes.

## Detalhes técnicos

- Nova RPC `admin_list_fornecedores(_search text, _limit int, _offset int)` — SECURITY DEFINER, `SET search_path = public`, guardada por `is_admin()`, retornando também `total_count`. Necessária porque as policies de `fornecedores` são restritas a `user_id = auth.uid()`, então o client do admin não lê a base inteira.
- Nova RPC `admin_get_fornecedor_detalhes(_fornecedor_id uuid)` — SECURITY DEFINER + `is_admin()`, devolvendo cadastro, cliente dono, lojas vinculadas e métricas de atividade (cotações recebidas via `cotacao_fornecedores`, respostas via `precos`).
- Nova RPC `admin_update_fornecedor(...)` — SECURITY DEFINER + `is_admin()`, para a correção de dados de contato; registra a alteração via `admin_registrar_contato` (canal `email`, motivo `manual`) na ficha do cliente dono.
- Frontend: `src/components/admin/FornecedoresTab.tsx` e `FornecedorAdminSheet.tsx`, novo item `{ value: "fornecedores", label: "Fornecedores", icon: Truck }` no grupo CLIENTES da sidebar do `AdminPage.tsx`, com renderização condicional por `activeTab` (padrão já existente).
- Export reaproveita `buildXlsx`/`downloadXlsx`/`todayFileSuffix` de `src/lib/adminExports.ts`, com header e linha novos.
- TanStack Query com `placeholderData` e debounce de 300 ms na busca, igual ao `CatalogoTab`.
- Testes unitários para a linha/header do export e para a normalização de nome usada na detecção de duplicados.
- Sem alteração nas policies existentes de `fornecedores`; nenhum cliente passa a ver fornecedor de outro.

## Fora de escopo

A Rede/Vitrine de Fornecedores compartilhada e o autocadastro do fornecedor ficam para a etapa seguinte, depois que a base estiver consolidada e auditada aqui.
