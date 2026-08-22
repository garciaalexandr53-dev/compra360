# Ajustes na aba Insights do Histórico

## Situação atual

A implementação dos dois ajustes já está presente no código-fonte e precisa ser validada:

- `src/lib/historicoInsights.ts`: `buildFornecedorRanking` já recebe o mapa de `itensCotados` e calcula a taxa como `vitórias ÷ itens cotados`, limitado a 100%.
- `src/pages/HistoricoPage.tsx`: já existe o `useMemo` que conta os itens cotados por fornecedor (preço > 0) dentro do período filtrado, e a UI já exibe "X% dos itens que cotou" no ranking mobile e "Itens cotados" / "Taxa" na tabela desktop.
- O card "Economia estimada" já mostra o percentual sobre o total do período (ex: "8,6% de economia · vs. média dos preços recebidos").

## O que falta fazer

1. **Rodar testes e typecheck** — garantir que `src/lib/historicoInsights.test.ts` passa e que não há erros de TypeScript.
2. **Verificar preview** — abrir a aba Insights em períodos 7/30/90/tudo e confirmar que:
   - O ranking de fornecedores mostra percentuais plausíveis (não 1200% etc.).
   - O card de Economia estimada exibe o valor e o percentual formatado em pt-BR.
   - Os demais cards (Total, Produtos únicos, Fornecedores) permanecem inalterados.
3. **Verificar responsivo** — testar em 360px (mobile) e desktop; confirmar que os cards e a tabela não quebram.
4. **Se alguma discrepância for encontrada**, corrigir o denominador, a formatação do percentual ou a query de preços conforme o caso.

## Critérios de conclusão

- Build verde (testes + typecheck).
- Insights sem valores impossíveis no ranking.
- Card de economia com percentual visível.
- Layout intacto em mobile 360px e desktop.
