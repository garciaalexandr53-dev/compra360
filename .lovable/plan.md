# Remover o seletor de loja duplicado no Dashboard

## O que está acontecendo (verificado no código)

No `/dashboard` o cliente com mais de uma loja vê **dois seletores de loja** ao mesmo tempo:

1. **Cabeçalho** (`src/components/AppLayout.tsx`, linha 91): `{!isLojas && <LojaSelector />}` — sempre visível no header, ao lado do título "Compra360".
2. **Card "1 Selecionar loja"** (`src/pages/DashboardPage.tsx`, linhas 673–721): aparece apenas no estado inicial do dashboard (`state === 1`, sem cotação ativa) e quando `lojas.length > 1`.

O usuário acha confuso ter os dois na mesma tela e quer eliminar o do cabeçalho.

## Por que esconder só no Dashboard

O `LojaSelector` do cabeçalho é global — é o único seletor de loja em todas as outras páginas (Cotação, Produtos, Fornecedores, Análise, etc.). Removê-lo do `AppLayout` inteiro tiraria a troca de loja de todo o sistema. A duplicação só acontece no Dashboard, porque só ele tem um seletor próprio no corpo da tela.

Além disso, quando há uma **cotação ativa** (estados 2–5 do dashboard), a cotação já está vinculada a uma `loja_id` específica; trocar a loja global no header não muda a loja da cotação ativa e pode confundir. Portanto esconder o seletor do header no `/dashboard` inteiro (e não só no estado 1) é a escolha mais limpa e segura.

Nas outras páginas o seletor do cabeçalho segue igual.

## O que será feito

1. Em `src/components/AppLayout.tsx`, condicionar a renderização do `LojaSelector` para não aparecer no `/dashboard`:
   - Trocar `{!isLojas && <LojaSelector />}` por `{!isDashboard && !isLojas && <LojaSelector />}`.
   - A variável `isDashboard` já existe (linha 34: `location.pathname === "/dashboard"`).
2. Manter o card "1 Selecionar loja" do `DashboardPage.tsx` exatamente como está (ele continua sendo o seletor durante a montagem da cotação).
3. Sem alteração de queries, mutations, RLS, banco ou lógica de negócio — apenas uma classe/condição de renderização no header.

## Detalhes técnicos

- Arquivo alterado: apenas `src/components/AppLayout.tsx` (1 linha).
- Desktop e mobile mantêm o seletor no cabeçalho em todas as páginas exceto `/dashboard`.
- No `/dashboard`, a seleção de loja passa a ser feita exclusivamente pelo card "1 Selecionar loja" (estado inicial) — igual ao comportamento atual do fluxo de nova cotação.

## Verificação

- Typecheck e testes (`vitest run`) sem regressões.
- Playwright (desktop e 360px) com conta de **mais de uma loja** logada:
  - Em `/dashboard`: confirmar que o cabeçalho não mostra o dropdown de loja e que o card "1 Selecionar loja" segue funcional (selecionar outra loja atualiza o contexto).
  - Em `/cotacao`, `/produtos`, `/fornecedores`: confirmar que o seletor do cabeçalho continua aparecendo e funcionando.
