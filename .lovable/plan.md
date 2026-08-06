# Corrigir "Responderam: 0" no Histórico

## O que está errado

O card do Histórico mostra `Responderam 0` em todas as cotações. Confirmei no banco:

- Cotações não ativas: 45
- Itens dessas cotações (`cotacao_produtos`): 1.139
- Preços válidos (> 0) dessas cotações: 4.770

A tela busca os itens e os preços em uma única consulta cada, sem paginação. O backend devolve no máximo 1.000 linhas por consulta, então:

- a lista de itens é cortada em 1.000 (produtos contados a menos em parte das cotações);
- a lista de preços é cortada em 1.000 de 4.770 — as cotações que ficam fora do primeiro lote acabam sem nenhum preço, e o contador de fornecedores que responderam vira 0.

Além disso, mandar 1.139 identificadores de item em uma só requisição gera uma URL muito longa, o que também pode fazer a consulta falhar silenciosamente.

## Correção

1. Buscar os itens das cotações do histórico com paginação (lotes de 1.000) até trazer todos.
2. Buscar os preços em blocos: dividir os identificadores de itens em pedaços (~200 por requisição) e paginar cada bloco, acumulando o resultado.
3. Recalcular, com os dados completos:
   - `Produtos` = total de itens da cotação;
   - `Responderam` = fornecedores distintos com preço maior que zero na cotação.
4. Nada muda no layout, filtros, abas Insights/Buscar Item, expansão do card ou exclusão de cotação.

## Detalhes técnicos

- Exportar o `fetchAllRows` já existente em `src/lib/supabaseHelpers.ts` (hoje é interno) e reutilizá-lo em `src/pages/HistoricoPage.tsx`, em vez de duplicar lógica de paginação.
- Na query `cotacoes-historico-v2`: substituir as chamadas diretas de `cotacao_produtos` e `precos` por leituras paginadas + chunk de `in(...)`.
- Aplicar o mesmo cuidado na consulta de `pedidos` (também usa `in` sobre 45 cotações — hoje seguro, mas fica com o mesmo padrão de paginação).
- Validar em 360px e desktop que os três contadores do card (Produtos, Responderam, Total pedido) exibem valores coerentes.
