# Manter o termo de busca depois de adicionar o item

Hoje, ao confirmar a quantidade de um produto, o campo de busca é zerado. Quem precisa lançar vários itens parecidos ("detergente ypê 500ml neutro", depois "maçã") tem que digitar tudo de novo.

## Novo comportamento (padrão único em todos os campos de busca manual)

1. Ao adicionar o item, o texto digitado **permanece** no campo e a lista de resultados continua na tela, pronta para o próximo item semelhante.
2. O campo só é limpo quando o funcionário toca no **"x"** do campo.
3. Ao **tocar/clicar no campo de busca**, todo o texto fica selecionado — se ele começar a digitar, o termo antigo é substituído automaticamente (nova busca sem apagar letra por letra); se ele apenas quiser completar o termo, basta tocar de novo para posicionar o cursor.
4. Após adicionar, o foco volta ao campo (como já acontece), agora com o texto selecionado — então dá para digitar o novo produto direto ou seguir clicando em outra linha da lista.
5. O feedback verde de "adicionado" na linha e o toast continuam iguais.

## Onde se aplica

- App Funcionários — aba de busca de produtos (`src/pages/AppFuncionariosPublic.tsx`): confirmação pelo diálogo de item e pelo fluxo antigo de confirmação.
- Nova cotação — busca de produtos (`src/pages/AddProdutosCotacaoPage.tsx`): hoje limpa o campo ao confirmar; passa a manter.
- Banco de Produtos (`src/pages/ProdutosPage.tsx`) e modal Catálogo Mestre: já mantêm o termo; recebem apenas o "seleciona tudo ao focar" para ficarem no mesmo padrão.

## Detalhes técnicos

- `src/components/shared/SearchInputComScanner.tsx`: adicionar `onFocus={(e) => e.target.select()}` no `Input` (mais `onClick` de select somente quando o campo não estava focado), mantendo o botão "x" como única forma de limpar. Botão "x" continua chamando `onChange("")` e devolvendo o foco.
- `AppFuncionariosPublic.tsx`: remover `setProductSearch("")` do `onConfirmar` do `AdicionarItemDialog` e de `confirmProductDialog`; manter o `focus()` e trocar por foco + seleção do texto.
- `AddProdutosCotacaoPage.tsx`: remover `setNome("")` de `handleDialogConfirm`, mantendo o foco/seleção.
- Sem mudanças em queries, RPCs, limites de plano ou lógica de snapshot.

## Verificação

- Testes existentes de `SearchInputComScanner` continuam passando; adicionar caso do select-on-focus.
- Screenshots via Playwright em 360px e desktop: buscar "detergente", adicionar um item, confirmar que o termo e a lista permanecem; tocar no campo e digitar substitui o termo; "x" limpa.
