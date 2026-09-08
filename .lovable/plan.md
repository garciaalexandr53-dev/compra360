# Dois ajustes: seletor de loja único no Painel + contagem de respostas na Cotação

## Tarefa 1 — Um único seletor de loja no Painel

### Situação atual (verificado no código)

No `/dashboard`, o cliente com mais de uma loja vê **dois seletores** na tela inicial:

1. **Cabeçalho** (`src/components/AppLayout.tsx`, linha 91): `<LojaSelector />` ao lado do título "Compra360".
2. **Card "1 Selecionar loja"** (`src/pages/DashboardPage.tsx`, linhas 673–721): só no estado inicial (`state === 1`, sem cotação ativa) e com `lojas.length > 1`.

A cotação ativa é buscada **por loja** (`DashboardPage.tsx`, linhas 183–186: `.eq("loja_id", lojaAtiva.id)`), então trocar a loja é o que permite **cotações simultâneas, uma por loja** — precisa continuar funcionando.

### Solução aprovada

Excluir o card "1 Selecionar loja" e mostrar o seletor **no lugar dele** na tela inicial. Um seletor por vez, nunca dois.

- **Painel, tela inicial:** seletor no corpo da tela, na posição do antigo passo 1, em largura total. Cabeçalho sem seletor.
- **Painel, com cotação ativa (estados 2–5):** seletor no cabeçalho, como hoje — é assim que se troca de loja para iniciar/continuar outra cotação.
- **Outras páginas:** seletor no cabeçalho, sem mudança.
- **Cliente com uma loja:** nada aparece (o `LojaSelector` já se oculta com `lojas.length <= 1`).

### O que será feito

1. `src/pages/DashboardPage.tsx`: remover o Card "Selecionar loja" e os estados `lojaStepOpen` / `lojaConfirmed`; renderizar `<LojaSelector />` em largura total nessa posição; ajustar a numeração do passo "Adicionar produtos"; sinalizar ao cabeçalho quando o seletor próprio está visível.
2. Novo `src/lib/dashboardHeaderStore.ts` (~20 linhas): mini-store com `useSyncExternalStore` para o Painel avisar o `AppLayout` (o Painel é filho do layout, então contexto comum não resolve filho → cabeçalho).
3. `src/components/AppLayout.tsx`: esconder o `LojaSelector` do cabeçalho quando essa sinalização estiver ativa.

## Tarefa 2 — "Fornecedor não respondeu" na tela de Cotação ignora quem marcou "Sem itens"

### Causa (verificada no código)

As duas telas usam critérios diferentes:

- **Painel** (`DashboardPage.tsx`, linhas 284–295): considera respondido quem tem **qualquer preço registrado** (`preco is not null`) — inclui quem enviou tudo zerado ("Sem itens"). Daí "18 de 21".
- **Cotação** (`CotacaoPage.tsx`, linhas 455–478): `supplierProgress` e `pendingFornecedores` exigem `preco > 0`. Quem marcou "Sem itens" (todos os preços 0) cai como **não respondeu**. Daí "14 de 21" e "7 ainda não responderam".

O Painel já sabe distinguir "Sem itens" (`DashboardPage.tsx`, linhas 255–264: fornecedor cujos preços são todos 0).

### O que será feito

1. Em `src/pages/CotacaoPage.tsx`, adotar o mesmo critério do Painel:
   - "Respondeu" = tem ao menos um preço registrado (`preco !== null`), inclusive zerado.
   - Calcular o conjunto "Sem itens" (todos os preços registrados iguais a 0), igual ao Painel.
   - `supplierProgress.responded` e `pendingFornecedores` passam a usar esse critério — o texto vira "18 de 21 fornecedores responderam" e o aviso amarelo passa a listar apenas os 3 realmente silenciosos.
2. Distinguir visualmente no chip do fornecedor: novo status `sem_itens` em `src/components/cotacao/StatusFornecedorBadge.tsx` (rótulo "Sem itens", estilo de alerta), para não parecer que o fornecedor cotou preços.
3. O botão "Seguir sem eles" continua igual, agora agindo somente sobre os fornecedores de fato pendentes.
4. Nada muda na matriz de preços, nos cálculos de menor preço ou na geração de pedidos: preço 0 continua sendo tratado como "sem preço" para efeito de comparação.

## Detalhes técnicos

- Arquivos: `src/pages/DashboardPage.tsx`, `src/components/AppLayout.tsx`, `src/pages/CotacaoPage.tsx`, `src/components/cotacao/StatusFornecedorBadge.tsx`, novo `src/lib/dashboardHeaderStore.ts`.
- Nenhuma alteração de banco, RLS, Edge Function, query de escrita ou regra de negócio de preços — apenas critérios de contagem no frontend e renderização.

## Verificação

- Typecheck e `vitest run` sem regressões.
- Playwright (desktop e 360px), conta com **duas ou mais lojas** e cotação ativa real:
  - Painel inicial: cabeçalho sem dropdown; seletor na posição do antigo passo 1 e trocando de loja.
  - Painel com cotação ativa: dropdown no cabeçalho funcionando.
  - Tela de Cotação: contagem igual à do Painel (mesmo número de respondentes nas duas telas) e o aviso amarelo listando apenas os pendentes reais; chip "Sem itens" visível para quem marcou sem itens.
  - `/produtos`, `/fornecedores`: seletor do cabeçalho inalterado.
