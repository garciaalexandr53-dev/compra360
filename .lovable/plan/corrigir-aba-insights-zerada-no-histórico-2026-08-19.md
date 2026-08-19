# Corrigir aba Insights zerada no Histórico

## O que está acontecendo

A aba Insights carrega os itens e preços de todas as cotações em uma única consulta sem paginação:

1. A busca dos itens da cotação traz no máximo 1000 linhas por requisição. Sua conta já tem 1.140 itens de cotação, então a lista chega cortada.
2. Com essa lista, o app monta uma segunda consulta de preços passando ~1000 identificadores de uma só vez na URL. Essa requisição fica gigante e falha; o erro não é tratado, então a lista de preços volta vazia.

Sem preços, nenhum item tem "vencedor" — e é exatamente isso que a tela mostra: 23 cotações contadas, mas R$ 0,00, 0 produtos, 0 fornecedores, ranking e variação sem dados. Mudar o período (7/30/90/tudo) não resolve porque o problema está no carregamento, não no filtro.

A aba "Buscar Item" já foi corrigida com paginação e blocos; a Insights ficou com o código antigo.

## Correção

Em `src/pages/HistoricoPage.tsx`, no carregamento em lote usado por Insights e pelo modo de seleção:

- Buscar os itens de cotação com `fetchAllRows` (paginado), em blocos de IDs de cotação, para não truncar em 1000 linhas.
- Buscar os preços em blocos de IDs de item (mesmo padrão já usado na aba Buscar Item), cada bloco também paginado, e concatenar os resultados.
- Propagar erro em vez de silenciá-lo, para que a tela mostre estado de erro em vez de zeros silenciosos.

Nenhuma mudança nos cálculos de KPI, ranking ou variação — eles já estão corretos e passam nos testes; hoje só recebem dados vazios.

## Verificação

- Abrir Insights com "Tudo" e com 7/30/90 dias e confirmar Total, Economia, Produtos únicos, Fornecedores, Ranking e Variação preenchidos.
- Conferir que os exports consolidados (modo de seleção) continuam funcionando.
- Testes existentes verdes; mobile 360px e desktop sem alteração visual.
