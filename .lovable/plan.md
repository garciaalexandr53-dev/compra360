# Itens sem preço: onde aparecem e como seguem para a próxima cotação

## Situação atual (verificada no código)

Fluxo sequencial: Análise de preços → Pedidos → enviar todos → tela de conclusão ("Concluído") → volta ao Dashboard.

Hoje, nesse caminho, os itens sem preço **não aparecem em nenhum ponto**:
- `ConclusaoScreen` mostra só economia, pedidos por fornecedor e total.
- Ao criar a nova cotação: em `DashboardPage`, a opção "Zerar tudo" **descarta** os itens sem preço; em `CotacaoPage` ela os leva, mas perde embalagem e fator.
- O único lugar onde eles aparecem é o filtro "Sem preço (19)" dentro da matriz da cotação.

## Onde o comprador vai ver — 3 pontos no fluxo

1. **Tela de conclusão (depois de enviar todos os pedidos)**
   Novo bloco abaixo da lista de pedidos:
   "19 itens não receberam preço de nenhum fornecedor" + lista recolhível com os nomes e a frase "Serão levados automaticamente para a próxima cotação." Informativo, não bloqueia o botão "Concluído".

2. **Modal de Nova Cotação**
   Linha informativa nas três opções: "19 itens sem preço serão levados para a nova cotação." Assim a informação aparece no momento exato da decisão.

3. **Dashboard / nova cotação criada**
   Banner na nova cotação: "19 itens vieram da cotação anterior por falta de preço" com atalho "Ver na cotação" que abre a matriz já com o filtro "Sem preço" aplicado. Dispensável com "x".

## O que será feito

1. **Helper único** (`src/lib/itensSemPreco.ts`): a partir dos itens da cotação e dos preços, retorna os itens que não receberam preço de nenhum fornecedor e monta o payload de inserção na nova cotação preservando o snapshot completo (nome, EAN, `catalogo_mestre_id`, `produto_id`, quantidade, embalagem e fator de embalagem).

2. **`DashboardPage`** — na opção "Zerar tudo", carregar os itens sem preço para a nova cotação usando o helper (hoje descarta). Nas opções "Manter", nada muda (já vão todos).

3. **`CotacaoPage`** — "Zerar tudo" usa o mesmo helper, corrigindo a perda de embalagem/fator.

4. **`ConclusaoScreen`** — recebe a lista de itens sem preço e exibe o bloco do ponto 1.

5. **`ModalNovaCotacao`** — nova prop opcional `semPrecoCount` para a linha informativa do ponto 2.

6. **Banner na nova cotação** (ponto 3) — o Dashboard registra quantos itens foram carregados e mostra o banner até ser dispensado (localStorage por cotação), com link para `/cotacao` com o filtro "Sem preço" ativo.

7. **Testes** unitários do helper: item sem nenhum preço entra; preço nulo ou zero conta como sem preço; item com preço de qualquer fornecedor não entra; snapshot preservado.

## Detalhes técnicos

- Critério de "sem preço": nenhuma linha em `precos` com `preco > 0` para aquele `cotacao_produto_id` — mesmo critério do `hasNoPrice` já usado em `CotacaoPage`.
- O filtro "Sem preço" da matriz passa a poder ser ativado por parâmetro de URL (`?semPreco=1`) para o atalho do banner funcionar.
- Nada muda na Análise, nos Pedidos, no Histórico ou no banco de dados (sem migração).
- Layout verificado em 360px e desktop.
