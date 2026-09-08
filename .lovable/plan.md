# Remover o seletor de loja duplicado na tela inicial do Dashboard

## O que está acontecendo (verificado no código)

No `/dashboard` o cliente com mais de uma loja vê **dois seletores de loja** ao mesmo tempo:

1. **Cabeçalho** (`src/components/AppLayout.tsx`, linha 91): `{!isLojas && <LojaSelector />}` — sempre visível no header, ao lado do título "Compra360".
2. **Card "1 Selecionar loja"** (`src/pages/DashboardPage.tsx`, linhas 673–721): aparece **apenas** no estado inicial do dashboard (`state === 1`, quando não há cotação ativa na loja) e quando `lojas.length > 1`.

Ou seja, a duplicação acontece somente na tela inicial de "Vamos começar uma nova cotação!".

## Cotações simultâneas continuam funcionando

A cotação ativa é buscada **por loja** (`DashboardPage.tsx`, linha 183–186: `queryKey: ["cotacao-ativa", lojaAtiva?.id]` com `.eq("loja_id", lojaAtiva.id)`). Isso significa que o seletor do cabeçalho é justamente o que permite:

- Ter uma cotação em andamento em cada loja ao mesmo tempo;
- Trocar de loja no cabeçalho e cair no dashboard daquela loja — que pode estar no estado inicial (pronto para começar nova cotação) enquanto a outra loja segue com cotação ativa.

Por isso o seletor do cabeçalho **não** será removido dos estados com cotação ativa (2 a 5). Ele é essencial ali.

## O que será feito

1. Em `src/pages/DashboardPage.tsx`, expor o estado atual do dashboard para o layout, de forma que o cabeçalho saiba quando o card "1 Selecionar loja" está sendo exibido. Implementação mais simples e sem prop drilling: um pequeno contexto/estado compartilhado — na prática, o `DashboardPage` sinaliza "seletor próprio ativo" enquanto `state === 1 && lojas.length > 1`.
2. Em `src/components/AppLayout.tsx`, esconder o `LojaSelector` do cabeçalho apenas quando essa sinalização estiver ativa. Nos demais casos (`state` 2–5, ou cliente com uma única loja, ou qualquer outra página) o cabeçalho continua exatamente como hoje.
3. Nada muda no card "1 Selecionar loja": ele segue sendo o seletor na tela inicial.

### Alternativa mais simples (se preferir menos código)

Manter o cabeçalho intocado e, em vez disso, **remover o card "1 Selecionar loja"** do estado inicial, deixando só o seletor do cabeçalho como ponto único de troca de loja em todo o sistema. Isso elimina a duplicação com uma mudança menor e sem estado compartilhado, mas o fluxo guiado perde o passo 1 (o passo "Adicionar produtos" passaria a ser o único). Podemos seguir por aqui se você achar melhor.

## Detalhes técnicos

- Arquivos: `src/components/AppLayout.tsx` e `src/pages/DashboardPage.tsx`.
- Apenas condição de renderização e um sinal de estado; nenhuma query, mutation, RLS, tabela ou regra de negócio alterada.
- A numeração dos passos ("1 Selecionar loja" / "2 Adicionar produtos") permanece como está.

## Verificação

- Typecheck e testes (`vitest run`) sem regressões.
- Playwright (desktop e 360px) com conta de **mais de uma loja** logada:
  - `/dashboard` em estado inicial: cabeçalho sem o dropdown de loja; card "1 Selecionar loja" funcional.
  - `/dashboard` com cotação ativa: dropdown do cabeçalho presente e trocando de loja corretamente, permitindo abrir/continuar cotação em outra loja.
  - `/cotacao`, `/produtos`, `/fornecedores`: seletor do cabeçalho inalterado.
