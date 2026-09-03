# Itens "sem preço" na matriz: preços existem, mas não são carregados

## O que está acontecendo (verificado no banco e no código)

Você está certo: **não é problema de dados**, é corte no carregamento.

A cotação de 02/09 tem **235 itens e 1.192 linhas de preço**. A matriz da cotação (`CotacaoPage`) busca os preços em **uma única consulta sem paginação**, e o backend devolve no máximo **1.000 linhas por consulta**. As ~192 linhas restantes nunca chegam à tela — os itens que caem nesse corte aparecem com célula vazia e entram no filtro "Sem preço", mesmo tendo preço salvo.

É exatamente o mesmo defeito que corrigimos no relatório do Histórico; a matriz (e várias outras telas) ficou com o código antigo.

Confirmação nos dados: além dos itens truncados, existem **19 itens realmente sem preço** — e esses só receberam registros de **R$ 0,00** (fornecedor marcou que não trabalha o item). Esses 19 continuam corretamente como "sem preço". Os demais que você viu vão voltar a mostrar os preços.

## Correção

Aplicar o mesmo padrão já usado no Histórico: carregar preços e itens **paginados, em blocos de ~200 IDs**, até acabar — nunca em uma consulta única.

Telas com o mesmo corte, todas incluídas na correção:

- Matriz da cotação (`CotacaoPage`) — preços e itens da cotação
- Análise de preços (`AnalisePage`)
- Resumo (`ResumoPage`)
- Pedidos (`PedidosPage`)
- Dashboard (cards de economia, respostas por fornecedor, histórico do dashboard)
- Links e Fornecedores (contagem de "respondeu")

Nada muda na aparência nem na lógica de vencedor/total: muda só a forma de buscar os dados.

## Verificação

- Abrir a cotação de 02/09: o filtro "Sem preço" deve cair para **19** itens, e o Rexona Active Emotion deve mostrar DEYCON R$ 13,25 na matriz.
- Conferir Análise, Resumo e Pedidos: totais coerentes com o relatório do Histórico.
- Mobile 360px e desktop sem alteração visual.

## Detalhes técnicos

- Criar helper em `src/lib/supabaseHelpers.ts` (ex.: `fetchPrecosByCpIds(cpIds, select)`) que faz chunk de 200 IDs + `fetchAllRows` por bloco e concatena, propagando erro.
- Substituir cada `supabase.from("precos").select(...).in("cotacao_produto_id", cpIds)` das telas listadas por esse helper; em `CotacaoPage` também paginar `cotacao_produtos`.
- Sem migração de banco, sem mudança de layout, sem alteração nos cálculos.

## Fora de escopo

O módulo maior de itens sem preço (banner na Análise/Resumo/Pedidos, carregamento automático para a próxima cotação) segue no backlog.
