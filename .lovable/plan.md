# Cabeçalho no mobile: seletor de loja + botão "Sair" sem corte

## O que está acontecendo (verificado no código)

No `src/components/AppLayout.tsx` o cabeçalho tem largura fixa demais para 360–411px:
- Lado esquerdo: nome da tela ("Compra360") + `LojaSelector`, cujo `SelectTrigger` tem **largura fixa `w-[180px]`** (`src/components/LojaSelector.tsx`), mais um ícone de loja.
- Lado direito: botão de tema, ícone de admin (quando aplicável) e o botão "Sair" com ícone + texto.

Quando o cliente tem mais de uma loja o seletor aparece e ocupa 180px + ícone, empurrando o bloco da direita para fora da tela — o "Sair" fica cortado. Não há `min-w-0`/`shrink` em nenhum dos dois lados, então nada cede espaço.

## O que será feito

1. **Seletor de loja flexível**: trocar a largura fixa por largura fluida no mobile (`w-full` com `min-w-0` e um máximo, ex. `max-w-[10rem]`, voltando a 180px a partir de `sm`), com o nome da loja truncado em vez de esticar o cabeçalho. Ícone de loja escondido no mobile (o próprio seletor já comunica o contexto).
2. **Bloco esquerdo cede espaço**: `min-w-0` + `truncate` no título da tela, para o seletor nunca empurrar a direita.
3. **Botão "Sair" nunca cortado**: no mobile vira botão de ícone (com `aria-label="Sair"` e `title`), `shrink-0`; o texto "Sair" volta a aparecer a partir de `sm`. O grupo da direita recebe `shrink-0`.
4. Manter a confirmação de logout (AlertDialog) e todo o resto do cabeçalho igual.

## Detalhes técnicos

- Arquivos: `src/components/AppLayout.tsx` e `src/components/LojaSelector.tsx`.
- Apenas classes Tailwind e atributos de acessibilidade; nenhuma query, mutation ou regra de negócio alterada.
- Desktop mantém a aparência atual (seletor 180px, "Sair" com texto).

## Verificação

- Playwright com sessão logada em 320px, 360px, 411px e desktop, com **duas ou mais lojas** no contexto, checando `scrollWidth === clientWidth` no cabeçalho e o botão "Sair" totalmente visível (bounding box dentro da viewport).
- Screenshots do cabeçalho antes/depois no mobile.
