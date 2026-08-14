# Busca de produtos na aba "Enviados" (App Funcionários)

Hoje a aba "Enviados" só filtra por período (7/30/90 dias). Sem busca, o funcionário precisa rolar toda a lista para saber se um produto já foi enviado.

## O que será feito

1. Campo de busca no topo da aba "Enviados", logo acima do filtro de período:
   - Placeholder: "Buscar item enviado..."
   - Ícone de lupa e botão "x" para limpar.
2. Filtro em memória, sem nova consulta ao banco: compara o texto digitado com o nome do item, ignorando acentos e maiúsculas/minúsculas (mesma normalização já usada no app).
3. Contador atualizado conforme a busca: "N item(ns) encontrados em 'termo'" quando há busca; texto atual quando o campo está vazio.
4. Estado vazio específico da busca: "Nenhum item enviado com esse nome nos últimos {período} dias" + botão "Limpar busca".
5. Sem busca ativa, tudo continua igual: agrupamento por dia (Hoje/Ontem/data), badges Importado/Pendente, bloco "Itens frequentes".
6. Com busca ativa, o bloco "Itens frequentes" fica oculto para não competir com o resultado.

## Detalhes técnicos

- Arquivo único: `src/pages/AppFuncionariosPublic.tsx`.
- Novo estado local `buscaEnviados`; o `useMemo` `enviados` passa a aplicar período + termo antes de alimentar `enviadosGrouped`.
- Normalização por `String.normalize("NFD")` removendo diacríticos, no padrão já usado no projeto.
- Nenhuma alteração na RPC `get_itens_enviados_publico`, nas queries ou no restante das abas.

## Verificação

- Screenshots via Playwright na aba Enviados em 360px e desktop: lista sem busca, com busca com resultado e com busca sem resultado.
