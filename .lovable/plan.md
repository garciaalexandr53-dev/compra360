# Apertar o plano Pro (limites por cotação)

## Novos limites

| Plano | Lojas | Produtos/cotação | Fornecedores/cotação | Cotações simultâneas | Importação em massa |
|---|---|---|---|---|---|
| Free | 1 | 25 | 4 | 1 | Não |
| Pro | 2 | 100 | 30 (mantido) | 2 | **Não** |
| Business | ∞ | ∞ | ∞ | ∞ | Sim |

Você não citou fornecedores por cotação no Pro; mantenho os 30 atuais. Se quiser apertar também, me diga o número.

## Mudanças

### 1. Dados dos planos
Atualizar o registro `pro` da tabela `plans` (data update, não migration): `max_lojas = 2`, `max_produtos = 100`, `max_cotacoes_simultaneas = 2`.

### 2. Importação em massa passa a ser Business
- `src/pages/ProdutosPage.tsx`: trocar o gate `checkPlan("pro", "Importação em massa")` por `checkPlan("business", ...)`.
- `src/pages/DashboardPage.tsx`: trocar o gate `checkPlan("pro", "Importação do ERP")` por `checkPlan("business", ...)`.

### 3. Textos dos planos
- `src/components/PlanosModal.tsx` (card Pro): "Até 2 lojas", "Até 100 produtos por cotação", "2 cotações simultâneas"; remover "Importação em massa (CSV/Excel)".
- `src/pages/LandingPage.tsx` (`proFeatures`): mesmos ajustes; adicionar "Importação em massa (CSV/Excel)" na lista do Business.
- `src/components/PlanosModal.test.tsx` / `LandingPage.planos.test.tsx`: ajustar apenas se algum teste checar esses textos.

### 4. Ponto a observar: "cotações simultâneas" hoje não é aplicado
O limite `max_cotacoes_simultaneas` está definido nos planos, mas nenhum lugar do código o valida — o app sempre trabalha com uma única cotação ativa (`CotacaoPage` busca `status = 'ativa'` com `limit(1)`). Ou seja, "2 cotações simultâneas" no Pro seria só uma promessa de texto.

Proposta deste plano: atualizar o dado e o texto agora, e **não** implementar múltiplas cotações ativas nesta rodada (é uma mudança grande de fluxo: seletor de cotação ativa, contexto e navegação). Se preferir, eu removo "2 cotações simultâneas" do texto do Pro até que o recurso exista.

## Fora de escopo
- Preços dos planos e os 30 dias grátis do Business.
- Suporte a múltiplas cotações ativas simultâneas.
- Layout/design fora dos textos citados.

## Critérios de aceitação
- Build verde; mobile 360px e desktop.
- Usuário Pro é bloqueado no 101º produto da cotação e ao tentar cadastrar a 3ª loja.
- Importação em massa (produtos e ERP) exibe upgrade para Business em contas Free e Pro.
- Textos de PlanosModal e LandingPage refletem os novos limites.
