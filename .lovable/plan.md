# 1. Correção urgente: relatório da cotação perde preços (Rexona Active Emotion)

## O que aconteceu (verificado no banco)

O item **Desodorante Rexona Aerosol Active Emotion** da cotação de 02/09 **recebeu 8 preços** (DEYCON R$ 13,25 até MARTINS R$ 15,57, mais um R$ 0,00 do WALLMART). Ele **não** é um item sem preço.

O problema está no relatório: a cotação de 02/09 tem **235 itens e 1.192 linhas de preço**, e a consulta que monta o detalhe/relatório da cotação no Histórico busca todos os preços de uma vez, sem paginação. O backend devolve no máximo **1.000 linhas por consulta** — as ~192 linhas restantes ficam de fora, e os itens que caíram nesse corte aparecem com "—" no fornecedor, no preço e no total.

Isso explica exatamente o que você viu: a aba **Buscar Item** usa uma consulta paginada e em blocos (mostra os preços corretamente), enquanto o **relatório/PDF da cotação** usa a consulta sem paginação (mostra "—").

Outros itens afetados na mesma cotação, todos com preço no banco e "—" no relatório: Goiabada Lata 600g (4 preços), Mistura Condensada Mococa 395g (9 preços), Rexona Clinical M Clean (5), Red Aplle Acropole 55g (2), Colgate Lum White Carvão 60g (7), Palha de Aço Brillo (3), Aperol 750ml (1). Consequência: o **TOTAL GERAL do relatório está subestimado**.

## Correção

- A consulta de detalhe da cotação passa a carregar os preços **em blocos de ~200 itens, com paginação completa** — exatamente o mesmo padrão já usado na aba Buscar Item e na lista de cotações. O mesmo tratamento vale para a leitura dos itens da cotação, para não haver corte quando uma cotação passar de 1.000 linhas.
- Nada muda na aparência do relatório: mesmas colunas, mesma ordem, mesmo Excel/PDF/impressão. O que muda é que os itens deixam de aparecer como "—" e o total volta a fechar.
- Verificar depois da correção, na cotação de 02/09: Rexona Active Emotion sai com DEYCON R$ 13,25, e o TOTAL GERAL sobe em relação aos R$ 25.831,21 exibidos hoje.
- Itens realmente sem nenhum preço (ex.: Querosene Petrus 1lt, Axe Gold Temptation) continuam corretamente como "—".

### Detalhes técnicos

- `src/pages/HistoricoPage.tsx`, query `cotacao-details-v2`: trocar o `supabase.from("precos").select(...).in("cotacao_produto_id", cpIds)` único por laço em blocos com `fetchAllRows` (`src/lib/supabaseHelpers.ts`), mantendo `*, fornecedores(id, nome)`; idem para `cotacao_produtos`.
- Sem migração de banco, sem alteração em `historicoExports.ts`, sem mudança de layout.

# 2. Depois: itens sem preço mais visíveis

## Por que hoje é difícil achar

Os itens sem preço só aparecem em três lugares discretos: o chip "Sem preço (N)" dentro da matriz da cotação, um bloco na tela de conclusão e um banner no Painel após criar a próxima cotação. Nas telas de fechamento (Análise, Resumo, Pedidos) não há nenhuma menção, e não existe uma lista completa que possa ser lida ou exportada.

## O que será feito

### Um modal único "Itens sem preço"

- título com a contagem;
- explicação: nenhum fornecedor respondeu; não entram nos pedidos e são levados para a próxima cotação;
- lista completa e rolável (nome, quantidade, embalagem) com busca interna;
- botões **Copiar lista**, **Exportar Excel** e **Ver na cotação** (matriz já filtrada).

### Pontos de acesso

- **Análise de preços** e **Resumo**: alerta no topo com botão "Ver itens".
- **Pedidos**: aviso deixando claro que esses itens não estão em nenhum pedido.
- **Cotação (matriz)**: o chip "Sem preço (N)" ganha ao lado um link "ver lista".
- **Tela de conclusão**: "Ver todos os N itens" em vez de listar só os 8 primeiros.
- **Histórico**: mesma contagem e mesmo modal na cotação finalizada.

### Detalhes técnicos

- Critério único já existente: nenhuma linha em `precos` com `preco > 0` (`filtrarItensSemPreco` em `src/lib/itensSemPreco.ts`). Sem migração.
- Novo `src/components/cotacao/ItensSemPrecoDialog.tsx`, consumido por `AnalisePage`, `ResumoPage`, `PedidosPage`, `CotacaoPage`, `ConclusaoScreen` e `HistoricoPage`.
- Exportação com o `xlsx` já usado no projeto: Produto, EAN, Quantidade, Embalagem.
- Listas derivadas em memória onde a página já carrega `cotacao_produtos` e `precos`.
- Layout verificado em 360px e desktop.
