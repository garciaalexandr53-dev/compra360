# Corrigir corte dos botões no modal "Enviando cotação para fornecedores"

Na imagem (360–411px), o card do fornecedor coloca nome, telefone, botão "WhatsApp" e "Pular" na mesma linha horizontal. O botão verde é cortado na borda direita e o "Pular" nem aparece — o conteúdo não cabe na largura do modal no mobile.

## O que muda

- No card de cada fornecedor, a linha vira empilhada no mobile: nome + telefone em cima, botões ("WhatsApp" e "Pular") logo abaixo, ocupando a largura disponível. No desktop continua tudo em uma única linha, como hoje.
- Nome longo do fornecedor continua truncado com "…", sem empurrar os botões para fora.
- O rodapé de contagem ("0 enviado(s) · 0 pulado(s) · 1 restante(s)") ganha respiro para não apertar em telas estreitas.
- Nenhuma mudança no comportamento: mesma fila sequencial, mesmo `window.open` do WhatsApp, mesma persistência em localStorage, mesma tela de conclusão.

## Detalhes técnicos

Arquivo: `src/components/dashboard/SendQueueModal.tsx`

- Card do fornecedor: `flex items-center gap-3` → layout responsivo (`flex-col items-stretch sm:flex-row sm:items-center`), com o bloco de ações em `flex-wrap` e `w-full sm:w-auto`.
- Botões `WhatsApp`/`Pular` com `flex-1 sm:flex-none` no mobile para dividirem a linha.
- Rodapé de contadores: permitir quebra (`flex-wrap gap-x-3 gap-y-1`) em telas estreitas.

**Verificação:** typecheck verde e conferência do modal em 360px e desktop largo (Playwright), garantindo que nenhum botão fica cortado.
