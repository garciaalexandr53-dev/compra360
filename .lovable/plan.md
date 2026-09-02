# Itens sem preço: tornar visíveis e listáveis

## Por que você não encontrou

Hoje (verificado no código) os itens sem preço só aparecem em três lugares, todos discretos ou fora do caminho:

- um botão pequeno "Sem preço (N)" na barra de filtros dentro da matriz da cotação (`CotacaoPage`);
- um bloco na tela de conclusão, que só aparece logo depois de enviar todos os pedidos;
- um banner no Painel, só depois de criar a próxima cotação.

Nas telas onde você realmente fecha a compra — **Análise de preços**, **Resumo** e **Pedidos** — não existe nenhuma menção a itens sem preço. E em nenhum ponto existe uma lista completa dos nomes que possa ser lida, exportada ou enviada. Com 50+ itens, o filtro na matriz também não ajuda: ele apenas esconde as outras linhas.

## O que será feito

### 1. Uma lista de verdade (novo modal "Itens sem preço")

Um único modal reutilizável, com:
- título com a contagem ("52 itens sem preço nesta cotação");
- explicação em uma linha: nenhum fornecedor respondeu preço para estes itens; eles não entram nos pedidos e são levados automaticamente para a próxima cotação;
- lista completa e rolável com nome, quantidade e embalagem de cada item;
- campo de busca dentro da lista (útil com 50+ itens);
- botões **Copiar lista**, **Exportar Excel** e **Ver na cotação** (abre a matriz já filtrada).

### 2. Pontos de acesso claros

- **Análise de preços**: card de alerta no topo, ao lado do total da compra — "52 itens sem preço" com botão "Ver itens".
- **Resumo**: mesma linha de alerta, com o mesmo botão.
- **Pedidos**: aviso acima da lista de pedidos, deixando claro que esses itens não estão em nenhum pedido.
- **Cotação (matriz)**: o chip "Sem preço (52)" continua filtrando, e ganha ao lado um link "ver lista" que abre o modal.
- **Tela de conclusão**: o bloco atual passa a ter "Ver todos os 52 itens" abrindo o mesmo modal, em vez de mostrar só os 8 primeiros.

### 3. Histórico

Na cotação já finalizada, dentro do Histórico, a mesma contagem e o mesmo modal — para você conseguir revisar depois, como agora.

## Detalhes técnicos

- Critério único de "sem preço" já existente: nenhuma linha em `precos` com `preco > 0` para o `cotacao_produto_id` (`filtrarItensSemPreco` em `src/lib/itensSemPreco.ts`). Nenhuma regra nova, nenhuma migração de banco.
- Novo componente `src/components/cotacao/ItensSemPrecoDialog.tsx` (lista + busca + copiar + exportar), consumido por `AnalisePage`, `ResumoPage`, `PedidosPage`, `CotacaoPage`, `ConclusaoScreen` e `HistoricoPage`.
- Exportação Excel via o `xlsx` já usado no projeto; colunas: Produto, EAN, Quantidade, Embalagem.
- Onde a página já carrega `cotacao_produtos` e `precos`, a lista é derivada em memória (sem query nova). No Histórico, reaproveita o carregamento em lote já existente.
- Nenhuma alteração no cálculo de economia, nos cenários, nos pedidos ou no carregamento automático dos itens para a próxima cotação.
- Layout verificado em 360px e desktop.
