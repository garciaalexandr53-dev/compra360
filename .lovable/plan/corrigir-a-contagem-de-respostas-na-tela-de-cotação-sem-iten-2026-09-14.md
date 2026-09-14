# Corrigir a contagem de respostas na tela de Cotação ("Sem itens" conta como resposta)

## Causa (verificada no código)

As duas telas usam critérios diferentes para dizer quem "respondeu":

- **Painel** (`src/pages/DashboardPage.tsx`, linhas 284–295): respondeu = tem **qualquer preço registrado** (`preco is not null`), inclusive tudo zerado. Por isso mostra "18 de 21 fornecedores responderam". O Painel ainda separa quem marcou "Sem itens" (linhas 255–264: fornecedor com preços registrados e todos iguais a 0) e mostra o rótulo "Sem itens".
- **Cotação** (`src/pages/CotacaoPage.tsx`, linhas 455–478): `supplierProgress` e `pendingFornecedores` exigem `preco > 0`. Quem respondeu marcando "Sem itens" tem todos os preços 0 e cai como **não respondeu**. Daí "14 de 21" e o aviso "7 fornecedor(es) ainda não responderam".

Ou seja, o número correto é o do Painel; a tela de Cotação está subestimando as respostas.

## O que será feito

1. Em `src/pages/CotacaoPage.tsx`, alinhar o critério ao do Painel:
   - "Respondeu" passa a ser: existe ao menos um preço registrado para o fornecedor (`preco !== null`), inclusive zerado.
   - Calcular também o conjunto "Sem itens" (todos os preços registrados do fornecedor iguais a 0), do mesmo jeito que o Painel.
   - `supplierProgress.responded` e `pendingFornecedores` passam a usar esse critério: o contador vira "18 de 21 fornecedores responderam" e o aviso amarelo passa a listar apenas os que realmente não responderam ("3 fornecedor(es)…").
2. Distinguir no chip do fornecedor: novo status `sem_itens` em `src/components/cotacao/StatusFornecedorBadge.tsx` (rótulo "Sem itens", ícone e cor de alerta), para não dar a impressão de que ele enviou preços. `supplierStatus` em `CotacaoPage.tsx` retorna esse status quando o fornecedor está no conjunto "Sem itens".
3. O botão "Seguir sem eles" continua funcionando igual, agora atuando somente sobre os pendentes reais.
4. **Nada muda nos cálculos de preço**: menor preço, anomalias, filtro "Sem preço", total e geração de pedidos continuam ignorando valores 0 exatamente como hoje (`analyzePrices`, `hasNoPrice`, `getIntraAnomaly` seguem exigindo `> 0`).

## Detalhes técnicos

- Arquivos: `src/pages/CotacaoPage.tsx` e `src/components/cotacao/StatusFornecedorBadge.tsx`.
- Apenas critérios de contagem e apresentação no frontend; nenhuma alteração de banco, RLS, Edge Function, query de escrita ou regra de negócio.

## Verificação

- Typecheck e `vitest run` sem regressões.
- Playwright (desktop e 360px) com a cotação ativa real: conferir que o número de respondentes na tela de Cotação é **igual** ao do Painel, que o aviso amarelo lista apenas os pendentes de verdade e que os fornecedores "Sem itens" aparecem com o chip próprio.
