# Insights: corrigir taxa do ranking e mostrar % de economia

## 1. Taxa de vitória do ranking (bug)

Hoje o percentual divide as vitórias pelo número de **cotações** em que o fornecedor participou, o que produz valores acima de 100% ("24 vitórias · 2 cotações · 1200%").

Passa a ser: **itens vencidos ÷ itens que o fornecedor cotou com preço > 0**, limitado a 100%, exibido como "X% dos itens que cotou".

- Cada preço já traz o nome do fornecedor, então é possível contar, no período filtrado, em quantos itens cada fornecedor apresentou preço válido.
- Cards mobile: "24 vitórias · 40 itens cotados · 60% dos itens que cotou".
- Tabela desktop: a coluna "Cotações" passa a "Itens cotados" e "Taxa" mostra o novo percentual; o cabeçalho de ajuda (tooltip) é reescrito para a nova definição.
- Quando o fornecedor não tiver itens cotados contabilizados, a taxa mostra "—" em vez de um número enganoso.

## 2. Card "Economia estimada"

Passa a mostrar o valor em destaque e, abaixo, o percentual sobre o total do período:

```text
R$ 2.306,56
8,6% de economia · vs. média dos preços recebidos
```

Percentual = economia ÷ total no período × 100, uma casa decimal (vírgula, pt-BR). Quando o total é zero, mostra apenas "vs. média dos preços recebidos".

Os cards de Total, Produtos únicos e Fornecedores ficam inalterados.

## Detalhes técnicos

- `src/lib/historicoInsights.ts`: `FornecedorRanking` ganha `itensCotados`; `buildFornecedorRanking` recebe um segundo parâmetro opcional com a contagem de itens cotados por fornecedor e calcula `taxa = min(100, vitorias / itensCotados * 100)`. Sem o parâmetro, mantém o comportamento atual para não quebrar chamadas existentes.
- `src/pages/HistoricoPage.tsx`: novo memo que percorre `consolidated.perCotacao` (apenas cotações do filtro de Insights) somando, por nome de fornecedor, os itens com `preco > 0`; passa esse mapa para `buildFornecedorRanking`. Ajustes de texto/colunas no ranking e no card de economia.
- Novos casos em `src/lib/historicoInsights.test.ts` cobrindo a taxa com denominador de itens e o teto de 100%.

## Verificação

Testes e typecheck verdes; conferir Insights em 360px e desktop com períodos 7/30/90/tudo.
