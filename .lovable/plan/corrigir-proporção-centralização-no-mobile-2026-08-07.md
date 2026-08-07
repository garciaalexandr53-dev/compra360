# Corrigir proporção/centralização no mobile

## Diagnóstico (confirmado no código)

`src/components/ui/dialog.tsx` usa no `DialogContent`:

```
fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] ... p-6
```

Dois problemas em telas estreitas:

1. `w-full` sem margem lateral: em 411px o modal ocupa 100% da largura e os `p-6` (24px de cada lado) comprimem o conteúdo.
2. Container `grid`: filhos de grid têm `min-width: auto`, então uma linha que não caiba (ex. o rodapé do onboarding com "Pular por agora" + "Voltar" + "Começar a cotar") **estica o modal além da viewport**. Como a centralização é `left-50% + translate-x(-50%)` sobre essa largura inflada, o modal sai do centro e o conteúdo é cortado à direita — exatamente o que aparece nos dois prints (Etapa 2 deslocada, Etapa 5 cortada).

## O que será feito

1. **Base do Dialog** (`src/components/ui/dialog.tsx`)
   - Largura segura no mobile: `w-[calc(100vw-2rem)] sm:w-full`, `max-w-lg`, `max-h-[90dvh]`, `overflow-y-auto`, `overflow-x-hidden`.
   - Evitar o estouro por conteúdo: `min-w-0` nos filhos do grid.
   - Padding responsivo: `p-4 sm:p-6`.
   - Mesma correção aplicada ao `AlertDialog` se apresentar o mesmo padrão.

2. **Onboarding** (`src/components/OnboardingWizard.tsx`)
   - Rodapé passa a quebrar no mobile: "Pular por agora" em linha própria, "Voltar"/"Avançar" lado a lado, botões com `flex-1` e texto truncável em vez de forçar largura.
   - Barra de etapas (ícones + progresso) com largura contida, sem ultrapassar o modal.
   - Textos longos (resumo da Etapa 5, próximos passos) com quebra normal em 360px.

3. **Varredura das outras páginas**
   - Script Playwright rodando cada rota autenticada e pública em 360px e 411px, comparando `document.scrollWidth` com `clientWidth` e localizando o elemento culpado por overflow.
   - Corrigir cada ocorrência encontrada com o mínimo necessário (`min-w-0`, `flex-wrap`, `truncate`, tabela com `overflow-x-auto` no container correto).
   - Rechecar em desktop largo para não regredir.

## Detalhes técnicos

- Apenas CSS/classes Tailwind e estrutura de layout; nenhuma query, mutation ou regra de negócio alterada.
- Uso de `dvh` para altura evitando corte pela barra do navegador mobile.
- Tabelas de cotação continuam com scroll horizontal interno (comportamento intencional), não serão tratadas como overflow indevido.

## Verificação

- Screenshots em 360px, 411px e desktop do onboarding (etapas 1 a 5) e das páginas apontadas pela varredura.
- Relatório final listando as páginas que estavam estourando e o que foi ajustado em cada uma.
