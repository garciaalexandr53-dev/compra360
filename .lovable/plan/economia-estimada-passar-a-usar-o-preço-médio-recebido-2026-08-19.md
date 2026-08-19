# Economia estimada: passar a usar o preço médio recebido

Concordo — comparar com o pior preço infla o número e é fácil de contestar. A média dos preços recebidos por item é a referência mais defensável ("o que você pagaria comprando sem comparar"). O card de demonstração da landing page já usa média, então a mudança também deixa o sistema coerente.

## Nova regra de cálculo

Para cada item que recebeu 2 ou mais preços válidos:

```text
economia_item = (média dos preços recebidos − preço vencedor) × quantidade × fator
economia_total = soma de economia_item
```

Itens com apenas 1 preço continuam fora do cálculo (não há comparação possível).

## Onde muda

1. **Histórico › Insights** (KPI "Economia estimada")
   - Passa a somar `(média − vencedor)` em vez de `(pior − vencedor)`.
   - Legenda do card muda de "vs. piores preços recebidos" para "vs. média dos preços recebidos".

2. **Painel / tela de conclusão da compra** (card verde "Você economizou")
   - Mesmo cálculo: total pela média por item menos o total pelos vencedores.
   - Texto muda de "comparado ao fornecedor mais caro desta cotação" para "comparado à média dos preços recebidos nesta cotação".

3. **Exportações do Histórico** — se algum export levar o rótulo/valor de economia, o texto é atualizado junto para refletir a nova base.

## Detalhes técnicos

- `src/lib/historicoInsights.ts`: `computeEconomia` troca `Math.max(...all)` pela média de `all`; JSDoc atualizado. Testes em `historicoInsights.test.ts` ajustados para os novos valores esperados.
- `src/pages/HistoricoPage.tsx`: o laço que calcula `economia` (dentro do `kpis` memo) usa a média; legenda do card atualizada.
- `src/pages/DashboardPage.tsx`: query `economy-estimate` acumula `totalMedia` no lugar de `totalMax` e retorna `totalMedia − totalMin`; texto do card atualizado.
- `src/components/dashboard/ConclusaoScreen.tsx`: apenas o texto explicativo abaixo do valor.
- Nenhuma mudança de banco de dados; nada é recalculado historicamente (o número é sempre derivado dos preços já salvos).

## Verificação

Build e testes verdes; conferir Insights e o card de conclusão em 360px e desktop.
