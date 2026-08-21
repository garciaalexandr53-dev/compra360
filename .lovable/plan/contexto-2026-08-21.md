Mover o botão flutuante de suporte para dentro do menu "Mais" no mobile

## Contexto

Hoje o suporte por WhatsApp está disponível como botão flutuante em todas as telas do app logado (`SuporteFlutuante.tsx`), além de um link "Ajuda" no menu lateral desktop (`AppSidebar.tsx`). O usuário reportou que o botão flutuante em todas as telas prejudica a usabilidade e aumenta o risco de cliques acidentais. A proposta é concentrar o acesso ao suporte dentro do menu "Mais" no mobile, onde o usuário já busca outras funções secundárias.

## O que será feito

1. Remover o botão flutuante de suporte de todas as telas logadas.
   - Tirar a renderização de `<SuporteFlutuante />` de `src/components/AppLayout.tsx`.
   - Remover o arquivo `src/components/SuporteFlutuante.tsx` para não deixar dead code.

2. Adicionar o item "Ajuda" dentro do menu "Mais" no mobile (`src/components/BottomNav.tsx`).
   - Incluir um botão "Ajuda / Suporte" na grid do Sheet de "Mais opções", com ícone de mensagem/question.
   - O botão abre o WhatsApp do suporte em nova aba, usando a mesma URL pré-preenchida do desktop (`src/lib/suporte.ts`).
   - Reaproveitar os hooks já existentes (`useAuth`, `useProfile`, `useSubscription`, `useLojaAtiva`) para compor a mensagem.

3. Manter inalterado o item "Ajuda" já existente no menu lateral desktop (`src/components/AppSidebar.tsx`), no grupo "Mais" e no rodapé.

4. Verificar e ajustar testes afetados.
   - `src/components/PlanosModal.test.tsx` e testes de `LandingPage` não devem ser impactados, mas validar build.
   - Se houver teste para `SuporteFlutuante`, removê-lo junto com o componente.

## Escopo

- Apenas a navegação mobile do app logado (`BottomNav.tsx`) e a remoção do botão flutuante (`AppLayout.tsx` + `SuporteFlutuante.tsx`).
- Não alterar a landing page, o `PlanosModal`, o `AppSidebar` desktop, o número de WhatsApp (`src/lib/suporte.ts`) nem a mensagem pré-preenchida.
- Não alterar nenhuma tabela, política, Edge Function ou backend.

## Critérios de aceitação

- [ ] Botão flutuante verde não aparece mais em nenhuma tela do app logado.
- [ ] Menu "Mais" no mobile exibe um item "Ajuda" que abre o WhatsApp com mensagem pré-preenchida.
- [ ] Desktop continua mostrando "Ajuda" no menu lateral, como hoje.
- [ ] Build verde.
- [ ] Verificação visual em 360px e desktop: sem sobreposições, sem cortes, safe-area respeitada.
