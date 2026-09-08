# Um único seletor de loja no Dashboard (no lugar do card "1 Selecionar loja")

## Situação atual (verificado no código)

No `/dashboard`, o cliente com mais de uma loja vê **dois seletores** ao mesmo tempo na tela inicial:

1. **Cabeçalho** (`src/components/AppLayout.tsx`, linha 91): `<LojaSelector />` ao lado do título "Compra360".
2. **Card "1 Selecionar loja"** (`src/pages/DashboardPage.tsx`, linhas 673–721): aparece só no estado inicial (`state === 1`, sem cotação ativa) e quando `lojas.length > 1`.

A cotação ativa é buscada **por loja** (`DashboardPage.tsx`, linhas 183–186: `.eq("loja_id", lojaAtiva.id)`), então trocar a loja é o que permite manter **cotações simultâneas, uma por loja** — esse comportamento precisa continuar funcionando.

## Solução aprovada

Excluir o card "1 Selecionar loja" e colocar o seletor (o mesmo `LojaSelector` do cabeçalho) **no lugar dele**, dentro da tela inicial. Resultado: um único seletor de loja em cada situação, nunca dois.

### Comportamento por situação

- **Dashboard, estado inicial (sem cotação ativa):** o seletor aparece no corpo da tela, na posição do antigo passo 1 (estilizado para a largura total, como um campo do formulário). O cabeçalho **não** mostra o seletor nesse caso.
- **Dashboard, com cotação ativa (estados 2–5):** o seletor fica no cabeçalho, como hoje, permitindo trocar de loja para continuar/iniciar cotação em outra unidade.
- **Demais páginas (Cotação, Produtos, Fornecedores, Análise, etc.):** seletor no cabeçalho, sem mudança.
- **Cliente com uma única loja:** nada aparece (o `LojaSelector` já se oculta quando `lojas.length <= 1`).

## O que será feito

1. `src/pages/DashboardPage.tsx`:
   - Remover o Card "Selecionar loja" (linhas 673–721) e os estados `lojaStepOpen` / `lojaConfirmed` usados só por ele.
   - No lugar, renderizar `<LojaSelector />` em uma linha própria dentro do bloco do estado 1 (sem wrapper de card), ocupando a largura total.
   - Ajustar a numeração do passo "Adicionar produtos": como o passo 1 some como card, exibir o número apenas quando houver seletor visível (multi-loja), mantendo a lógica atual de `lojas.length > 1`.
   - Sinalizar para o cabeçalho quando a tela inicial com seletor próprio está visível (`state === 1 && lojas.length > 1`).
2. `src/lib/dashboardHeaderStore.ts` (novo, ~20 linhas): mini-store com `useSyncExternalStore` para o `DashboardPage` avisar o `AppLayout` que o seletor deve sumir do cabeçalho (o Dashboard é filho do layout, então contexto comum não serve para comunicar filho → cabeçalho).
3. `src/components/AppLayout.tsx`: subscrever o store e esconder o `LojaSelector` do cabeçalho apenas quando a sinalização estiver ativa.
4. Sem alteração de queries, mutations, RLS, banco ou regra de negócio.

## Detalhes técnicos

- Arquivos: `src/pages/DashboardPage.tsx`, `src/components/AppLayout.tsx`, novo `src/lib/dashboardHeaderStore.ts`.
- O `LojaSelector` recebe uma variação de estilo (largura total) via prop opcional ou classe de container; o seletor do cabeçalho das outras páginas permanece com a aparência atual.
- A troca de loja continua chamando `setLojaAtivaId` — cotações simultâneas por loja não são afetadas.

## Verificação

- Typecheck e `vitest run` sem regressões.
- Playwright (desktop e 360px), conta com **duas ou mais lojas**:
  - `/dashboard` inicial: nenhum dropdown no cabeçalho; seletor aparece na posição do antigo passo 1 e troca de loja funciona.
  - `/dashboard` com cotação ativa: dropdown presente no cabeçalho; trocar de loja leva ao estado da outra loja.
  - `/cotacao`, `/produtos`, `/fornecedores`: seletor do cabeçalho inalterado.
  - Conta com **uma loja**: nada aparece em nenhuma tela.
