# Ajuda de busca por EAN no App de Funcionários

Objetivo: deixar claro para o funcionário que o campo de busca da aba "Itens Faltantes" também aceita código de barras.

## Mudanças

1. Placeholder do input de busca: de "Buscar produto..." para "Buscar por nome ou código de barras".
2. Linha de ajuda discreta logo abaixo do campo (`text-xs text-muted-foreground`), exibida somente quando o campo está vazio: "Digite o nome do produto ou escaneie/digite o código de barras (EAN)".

Nada de lógica de busca, RPCs ou layout de resultados é alterado.

## Detalhes técnicos

- Arquivo único: `src/pages/AppFuncionariosPublic.tsx`, bloco da barra de busca (~linhas 796-819).
- A ajuda entra dentro do container `space-y-2` existente, condicionada a `productSearch.length === 0`, com `leading-snug px-1` para não quebrar o espaçamento do sticky header.
- Sem novos tokens de cor: apenas `text-muted-foreground`.

## Verificação

- Captura de tela via Playwright em 360px (mobile) e 1440px (desktop) na rota do app de funcionários, confirmando que a linha de ajuda cabe em duas linhas no mobile, uma no desktop, e desaparece ao digitar.
