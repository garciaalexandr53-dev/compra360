# Remover o aviso "pedidos aguardando confirmação" do Painel

## Decisão

Remover o aviso do Painel. Conforme esclarecido, o "recebido" só é marcado pela loja na conferência do pedido recebido; como isso raramente acontece na rotina, o contador de pedidos "enviados" só acumula (hoje são 205+) e o aviso deixa de refletir um pendente real. Por isso, em vez de corrigir o filtro, vamos retirá-lo.

## O que é o aviso hoje

No `DashboardPage`, um `useQuery` (`pedidos-pendentes`) conta **todos** os pedidos com situação `enviado`, de **todas as lojas e cotações antigas**, sem filtro de loja nem de data. Um bloco de botão azul exibe "X pedido(s) aguardando confirmação" e, ao clicar, navega para `/analise` — tela que só trabalha com a cotação ativa, por isso abre vazia.

## Alterações (somente frontend, sem banco/RLS/Edge Function)

1. **`src/pages/DashboardPage.tsx`**
   - Remover o `useQuery` `pedidos-pendentes` (linhas ~307–313).
   - Remover o bloco do botão azul "Pedidos aguardando confirmação" (linhas ~763–769).
   - Manter o `import` do ícone `Clock` (ainda usado em outros pontos do arquivo).

2. **`src/components/dashboard/DashboardAlerts.tsx`**
   - Componente sem uso real (não é importado em nenhum lugar) e que também aponta para `/analise`. Excluir o arquivo.

## Não alterar

- Os alertas de itens faltantes permanecem.
- Nenhuma alteração no banco, RLS, policies ou Edge Functions.
- Os pedidos antigos não são apagados; apenas deixam de gerar o aviso.

## Validação

- Typecheck verde.
- Verificar no preview (desktop e 360px) que o aviso não aparece mais no Painel e que o restante do layout permanece íntegro.
