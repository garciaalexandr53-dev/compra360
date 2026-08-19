# Itens sem preço sempre seguem para a próxima cotação

## Situação atual (verificada no código)

Existem dois caminhos de fechamento com o mesmo modal (`ModalNovaCotacao`), mas comportamentos diferentes:

| Caminho | Manter itens / Manter + preços | Zerar tudo |
|---|---|---|
| `CotacaoPage` (matriz) | leva todos os itens | leva os itens sem preço, mas **perde embalagem e fator** (não copia `tipo_embalagem` / `fator_embalagem`) |
| `DashboardPage` (Painel) | leva todos os itens | **descarta tudo**, inclusive os itens sem preço |

Ou seja: fechando pelo Painel com "Zerar tudo", os 19 itens sem preço de hoje desaparecem.

## O que será feito

1. **Helper único** (`src/lib/itensSemPreco.ts`): dado a cotação antiga e os preços, retorna os itens que não receberam preço de nenhum fornecedor e monta o payload de inserção na nova cotação preservando o snapshot completo (nome, EAN, `catalogo_mestre_id`, `produto_id`, quantidade, embalagem e fator de embalagem).

2. **`DashboardPage`** — na opção "Zerar tudo", passa a carregar os itens sem preço para a nova cotação usando o helper (hoje descarta).

3. **`CotacaoPage`** — a opção "Zerar tudo" passa a usar o mesmo helper, corrigindo a perda de embalagem/fator.

4. **Aviso informativo no modal** (`ModalNovaCotacao`, sem bloquear): quando houver itens sem preço na cotação atual, mostrar uma linha do tipo
   "19 itens ficaram sem preço — eles serão levados automaticamente para a nova cotação."
   Exibida nas três opções, já que em todas eles seguem. O fluxo de confirmação atual não muda.

5. **Testes** unitários do helper: item sem nenhum preço entra; item com preço zero/nulo conta como sem preço; item com preço de qualquer fornecedor não entra; snapshot (embalagem/fator/EAN) preservado.

## Detalhes técnicos

- Critério de "sem preço": nenhuma linha em `precos` com `preco > 0` para aquele `cotacao_produto_id` — mesmo critério já usado por `hasNoPrice` em `CotacaoPage`.
- O modal recebe uma nova prop opcional `semPrecoCount`, calculada em cada página a partir dos dados já carregados. Sem query nova no Dashboard além da leitura de `precos` da cotação ativa.
- Nada muda na Análise, nos Pedidos, no Histórico ou no banco de dados (sem migração).
- Layout verificado em 360px e desktop.
