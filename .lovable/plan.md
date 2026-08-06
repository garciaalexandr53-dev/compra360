# Deixar claro o que acontece em "Menos Fornecedores"

## O problema (confirmado no código)

O cenário "Menos Fornecedores" agrupa itens e elimina fornecedores, mas ele é o único cenário que **não** produz o registro de movimentações (`cascadeResult`). Por isso o painel "🔍 O que o sistema ajustou" — que já existe e aparece na Economia Inteligente — nunca é exibido nesse card. O comprador vê apenas "7 fornecedor(es)" e um total, sem saber quem saiu, por que saiu e para onde foram os itens.

## O que vamos entregar

### 1. Registrar as movimentações do "Menos Fornecedores"
Passar a gravar, durante o cálculo:
- **Fornecedores removidos**, cada um com o motivo real:
  - "preço próximo — itens realocados" (consolidação por diferença até 5%)
  - "não atingiu o pedido mínimo (R$ X de R$ Y)"
- **Itens realocados**: produto, fornecedor de origem, fornecedor de destino, preço antes → preço depois e a diferença em R$.
- Contagem de fornecedores antes e depois.

### 2. Mostrar isso no card da estratégia
Reaproveitar o painel existente "O que o sistema ajustou" também no card "Menos Fornecedores", com uma seção nova:

```text
🚫 Fornecedores fora desta estratégia (3)
 · Distribuidora X — preço próximo, 2 itens realocados
 · Atacado Y — não atingiu o pedido mínimo (R$ 380 de R$ 800)

🔀 Itens realocados (5)
 · Açúcar União 5kg — Distribuidora X → MUFATAO
   R$ 5,58 → R$ 5,72 (+R$ 0,14/un)
```

Colapsado por padrão nesse card (para não pesar em 360px), com resumo na linha do cabeçalho: "3 fornecedores fora · 5 itens realocados". Custo extra total da consolidação exibido no rodapé do painel ("custo da simplificação: +R$ 42,10").

### 3. Explicação da IA coerente
O prompt de "Por que essa estratégia?" hoje só recebe dados de cascade da Economia Inteligente. Passará a receber também os do "Menos Fornecedores" (removidos com motivo, itens realocados, custo extra), mantendo as regras atuais de nunca inventar números.

### 4. Linha do card
Acrescentar, quando houver remoções, um indicador discreto ao lado de "7 fornecedor(es)": "3 fora" — sem alterar o layout nem o botão de ação.

## Detalhes técnicos

- `src/lib/scenarios.ts`: estender `CascadeResult`/`DiscardDetail`/`PullDetail` com `motivo`, `itensRealocados`, `precoAntes`/`precoDepois`, `custoExtra`; instrumentar `scenarioConsolidado` (loop de consolidação e loop pós-mínimos) para preencher e retornar `cascadeResult`. Nenhuma mudança na lógica de decisão — só instrumentação.
- `src/components/analise/PainelMovimentacoes.tsx`: novos campos opcionais (motivo, deltas de preço, custo extra) e prop `defaultExpanded`, mantendo compatibilidade com o uso atual.
- `src/pages/AnalisePage.tsx`: renderizar o painel para `scenario.id === "consolidado"` além de `"sem-minimo-abaixo"`; incluir os dados no prompt da explicação IA; badge "N fora" no cabeçalho.
- Teste unitário para `scenarioConsolidado`: garante que fornecedores eliminados aparecem em `discardDetails` com motivo e que a soma dos `custoExtra` dos itens realocados bate com `diffVsBaseline`.
- Validação responsiva em 360px e desktop.
