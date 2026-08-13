# Escala fluida no mobile + rodapé sempre visível

## O que está acontecendo (verificado no código)

1. **Tudo grande demais / sobra do lado ao reduzir o zoom**
   O app usa tamanhos fixos do Tailwind (`text-2xl`, `p-6`, `gap-6`...) pensados em desktop. Como você usa **fonte grande do sistema**, o Chrome Android multiplica todas as fontes em `rem`/`em`, então títulos e cards crescem e o layout empurra a tela. Ao reduzir o zoom, o navegador diminui tudo, mas o conteúdo continua com largura máxima de coluna — daí a faixa vazia à direita.

2. **Menu do rodapé escondido / aba "Mais" cortada**
   `src/components/BottomNav.tsx` usa a classe `safe-area-bottom` e o Sheet usa `pb-safe`, mas **nenhuma das duas existe** no projeto (não estão em `index.css` nem em `tailwind.config.ts`). Ou seja: hoje não há compensação da barra de gestos do Android/iOS — o rodapé fica parcialmente sob ela.
   Além disso o conteúdo usa `pb-16` fixo (`src/components/AppLayout.tsx`), sem somar a área segura, então o fim da página fica atrás da barra.

## O que será feito

### 1. Escala fluida por largura (320px → 480px)
- Definir em `src/index.css` uma raiz tipográfica fluida em **px** com `clamp()` (ex.: `clamp(14px, 3.6vw, 16px)`), aplicada só em telas < 640px. Como é px + vw, ela acompanha o aparelho e **não é inflada pela fonte grande do sistema**.
- Tokens fluidos de espaçamento/tipografia no Tailwind (`text-fluid-title`, `text-fluid-body`, `p-fluid`) para usar nas telas principais, no lugar dos saltos fixos.
- Aplicar nos pontos de maior impacto visual: header do Dashboard ("Vamos começar uma nova cotação!"), cards de passos 1/2, banners de pedidos e reposição, e cabeçalhos das páginas Cotação, Análise, Produtos, Fornecedores, Reposição.
- Garantir preenchimento total da largura no mobile: containers com `w-full` sem `max-w` travado abaixo de `sm`, mantendo a coluna centralizada no desktop (desktop não muda).

### 2. Área segura e rodapé
- Criar de fato as utilidades ausentes (`safe-area-bottom`, `pb-safe`) em `src/index.css` usando `env(safe-area-inset-bottom)`.
- `AppLayout`: trocar `pb-16` por `pb-[calc(env(safe-area-inset-bottom,0px)+4rem)]` no `<main>`, para que o último elemento nunca fique atrás do menu.
- `BottomNav`: altura mínima garantida, ícones e rótulos com escala fluida, e a aba **"Mais"** com largura própria (sem truncar o texto) — os 4 itens dividem a largura sem estourar em 320px.
- Folha "Mais opções" (Sheet): grade que se adapta (2 colunas em telas muito estreitas, 3 acima), com respiro inferior seguro.

### 3. À prova de fonte grande do sistema
- Rótulos críticos (menu, badges, botões) com `min-height` e `flex-wrap`/`truncate` corretos, para que aumentar a fonte do sistema não corte nada.
- Verificação com fator de fonte ampliado simulado (equivalente a "fonte grande") em 320px, 360px, 411px.

## Detalhes técnicos
- Apenas CSS/classes Tailwind, `index.css` e `tailwind.config.ts`; nenhuma query, mutation ou regra de negócio alterada.
- Sem alterar a meta viewport (continua `width=device-width, initial-scale=1`) e sem bloquear o zoom do usuário — acessibilidade preservada.
- Desktop mantém a aparência atual: todas as mudanças ficam em breakpoints abaixo de `sm`/`md`.

## Verificação
- Script Playwright capturando Dashboard, Cotação, Análise, Produtos, Fornecedores e Reposição em 320px, 360px, 411px e desktop, comparando `scrollWidth` vs `clientWidth` (zero overflow horizontal).
- Screenshots do rodapé mostrando os 4 itens completos e a folha "Mais opções" sem corte.
- Relatório final com antes/depois do Dashboard no mobile.
