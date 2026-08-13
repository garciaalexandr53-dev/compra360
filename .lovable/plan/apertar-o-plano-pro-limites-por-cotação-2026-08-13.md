# Apertar o plano Pro (limites por cotação)

## Novos limites

| Plano | Lojas | Produtos/cotação | Fornecedores/cotação | Fornecedores no cadastro | Cotações ativas | Importação em massa |
|---|---|---|---|---|---|---|
| Free | 1 | 25 | 4 | 4 | 1 (1 loja) | Não |
| Pro | 2 | 100 | 20 | 20 | 2 (1 por loja) | **Não** |
| Business | ∞ | ∞ | ∞ | ∞ | ∞ (1 por loja) | Sim |

## Sobre "cotações simultâneas" — o que realmente acontece hoje

Verificado no código: a cotação ativa é buscada **por loja** (`CotacaoPage`/`DashboardPage` filtram `status = 'ativa'` junto com `loja_id` da loja ativa, com `limit(1)`). Ou seja:

- Cada loja pode ter **uma** cotação ativa por vez.
- Você consegue 2 cotações simultâneas porque tem 2 lojas — exatamente o comportamento que descreveu.
- Não existe hoje nenhuma validação do campo `max_cotacoes_simultaneas`; o número de cotações simultâneas é, na prática, igual ao número de lojas permitidas.

Por isso o plano trata "cotações simultâneas" como consequência do limite de lojas: Free 1, Pro 2, Business ilimitado — e o texto dos planos passa a dizer "1 cotação ativa por loja", que é verdade. Nenhuma trava nova de cotação é criada.

## Mudanças

### 1. Dados dos planos
Atualizar o registro `pro` da tabela `plans` (data update): `max_lojas = 2`, `max_produtos = 100`, `max_fornecedores = 20`, `max_cotacoes_simultaneas = 2`.

### 2. Fornecedores: mesmo limite no cadastro e por cotação
Um único campo (`max_fornecedores`) passa a valer para os dois lugares: Free 4, Pro 20, Business ilimitado. Sem coluna nova.
- Por cotação: a checagem já existe em `src/pages/CotacaoPage.tsx` (`toggleSupplier`/`selectAllSuppliers`) e passa a usar os novos valores automaticamente.
- No cadastro: reativar `checkLimit("max_fornecedores", fornecedores.length, ...)` em `src/pages/FornecedoresPage.tsx` (foi removido na rodada anterior).

### 3. Importação em massa passa a ser Business
- `src/pages/ProdutosPage.tsx`: `checkPlan("pro", "Importação em massa")` → `checkPlan("business", ...)`.
- `src/pages/DashboardPage.tsx`: `checkPlan("pro", "Importação do ERP")` → `checkPlan("business", ...)`.

### 4. Textos dos planos
- `src/components/PlanosModal.tsx` (card Pro): "Até 2 lojas", "Até 100 produtos por cotação", "Até 20 fornecedores", "1 cotação ativa por loja"; remover "Importação em massa (CSV/Excel)".
- `src/pages/LandingPage.tsx` (`proFeatures`): mesmos ajustes; incluir "Importação em massa (CSV/Excel)" no Business.
- Ajustar os testes de planos apenas se algum deles verificar esses textos.

## Fora de escopo
- Preços dos planos e os 30 dias grátis do Business.
- Permitir mais de uma cotação ativa na mesma loja.
- Layout/design fora dos textos citados.

## Critérios de aceitação
- Build verde; mobile 360px e desktop.
- Conta Pro: bloqueio no 101º produto da cotação, no 21º fornecedor da cotação, no 21º fornecedor cadastrado e na 3ª loja.
- Conta Free: bloqueio no 5º fornecedor cadastrado e no 5º fornecedor da cotação.
- Importação em massa (produtos e ERP) exibe upgrade para Business em Free e Pro.
