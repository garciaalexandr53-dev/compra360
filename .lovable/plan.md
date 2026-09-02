# Correção: relatório da cotação perde preços (Rexona Active Emotion)

## O que aconteceu (verificado no banco)

O item **Desodorante Rexona Aerosol Active Emotion** da cotação de 02/09 **recebeu 8 preços** (DEYCON R$ 13,25 até MARTINS R$ 15,57, mais um R$ 0,00 do WALLMART). Ele **não** é um item sem preço.

O problema está no relatório: essa cotação tem **235 itens e 1.192 linhas de preço**, e a consulta que monta o detalhe/relatório da cotação no Histórico busca todos os preços de uma vez, sem paginação. O backend devolve no máximo **1.000 linhas por consulta** — as ~192 linhas restantes ficam de fora, e os itens que caíram nesse corte aparecem com "—" em fornecedor, preço e total.

Isso explica exatamente o que você viu: a aba **Buscar Item** usa consulta paginada e em blocos (mostra os preços corretamente), enquanto o **relatório/PDF da cotação** usa a consulta sem paginação (mostra "—").

Outros itens afetados na mesma cotação, todos com preço no banco: Goiabada Lata 600g (4 preços), Mistura Condensada Mococa 395g (9), Rexona Clinical M Clean (5), Red Aplle Acropole 55g (2), Colgate Lum White Carvão 60g (7), Palha de Aço Brillo (3), Aperol 750ml (1). Consequência: o **TOTAL GERAL do relatório está subestimado**.

## Correção

- A consulta de detalhe da cotação passa a carregar os preços **em blocos de ~200 itens, com paginação completa** — o mesmo padrão já usado na aba Buscar Item e na lista de cotações. Mesmo tratamento na leitura dos itens da cotação, para não haver corte quando uma cotação passar de 1.000 linhas.
- Nada muda na aparência: mesmas colunas, mesma ordem, mesmo Excel/PDF/impressão. O que muda é que os itens deixam de aparecer como "—" e o total volta a fechar.
- Verificação na cotação de 02/09: Rexona Active Emotion sai com DEYCON R$ 13,25, e o TOTAL GERAL sobe em relação aos R$ 25.831,21 exibidos hoje.
- Itens realmente sem nenhum preço (ex.: Querosene Petrus 1lt, Axe Gold Temptation) continuam corretamente como "—".

## E se a cotação for o dobro?

Não volta a falhar. A correção elimina os dois limites que existem hoje:

- **limite de 1.000 linhas por consulta** → resolvido pela paginação, que continua pedindo páginas até acabar (funciona com 1.200, 2.400 ou 20.000 linhas);
- **URL longa demais quando se envia muitos identificadores de uma vez** → resolvido pelos blocos de ~200 itens por requisição, independentemente do tamanho da cotação.

Uma cotação com o dobro (≈470 itens e ≈2.400 preços) faria cerca de 3 requisições em vez de 1, com poucos décimos de segundo a mais para abrir o relatório. Esse é o mesmo padrão que já sustenta a aba Insights e a Buscar Item hoje.

## Detalhes técnicos

- `src/pages/HistoricoPage.tsx`, query `cotacao-details-v2`: trocar o `supabase.from("precos").select(...).in("cotacao_produto_id", cpIds)` único por laço em blocos com `fetchAllRows` (`src/lib/supabaseHelpers.ts`), mantendo `*, fornecedores(id, nome)`; idem para `cotacao_produtos`.
- Sem migração de banco, sem alteração em `historicoExports.ts`, sem mudança de layout.

## Fica para depois

O módulo de visibilidade dos itens sem preço (modal com lista completa, acessos na Análise/Resumo/Pedidos) fica registrado no backlog e será tratado em outra etapa.
