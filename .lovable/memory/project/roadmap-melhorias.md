---
name: Roadmap de melhorias aprovadas (futuro)
description: Melhorias de gestão de supermercado aprovadas pelo usuário para implementar em breve — não re-propor como novidade, apenas retomar
type: feature
---
O usuário aprovou a direção destas melhorias (ago/2026) e pediu para deixá-las para "um futuro breve". Ao retomar, tratar como backlog já validado — não reapresentar como ideia nova.

Prioridade sugerida:
1. **Inteligência de preço na cotação** — referência histórica (média dos preços vencedores das últimas 5 cotações fechadas da loja) exibida na linha do produto na `TabelaCotacao`, com sinal de variação por célula (verde/neutro/vermelho, faixa neutra ~3%). Comparação sempre por preço unitário já convertido pelo fator de embalagem. Menos de 2 cotações históricas: não exibir nada. Linha de resultado no Resumo: "Esta cotação está R$ X (Y%) abaixo/acima da sua média histórica".
2. **Curva ABC de itens** — destacar na cotação e na análise os ~20% de itens que concentram o gasto.
3. **Cockpit de próximo passo no Painel** — bloco único no topo com a ação mais urgente e atalho de 1 toque.
4. **Relatório mensal de economia** — consolidado no Histórico, justifica a assinatura.
5. **Ruptura e cobertura de estoque** — cruzar reposição + conferência para sugerir o que comprar e quanto.
6. **Portal do fornecedor mais simples** — preenchimento por voz/foto de tabela, salvamento automático, repetir última cotação em 1 toque.
7. **Onboarding por resultado** — primeira cotação em 5 minutos com catálogo e fornecedor de exemplo.
8. **Simplificação por perfil** — comprador vê tudo; funcionário/conferente vê apenas sua tela.

O plano detalhado do item 1 estava em `.lovable/plan.md` (inteligência de preço) e pode ser retomado.
