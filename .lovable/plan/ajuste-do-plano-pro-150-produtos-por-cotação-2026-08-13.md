# Ajuste do plano Pro: 150 produtos por cotação

## Alteração

Elevar o limite de produtos por cotação do plano Pro de **100** para **150**. Os demais limites do plano Pro permanecem inalterados.

| Plano | Produtos/cotação | Outros limites |
|---|---|---|
| Free | 25 | 1 loja, 4 fornecedores, 1 cotação ativa |
| Pro | **150** | 2 lojas, 20 fornecedores, 1 cotação ativa por loja, sem importação em massa |
| Business | ∞ | Ilimitado + importação em massa |

## Mudanças

### 1. Dados do plano no backend
Data update no registro `pro` da tabela `plans`:
- `max_produtos = 150`

### 2. Textos de planos
- `src/components/PlanosModal.tsx`: card Pro passa de "Até 100 produtos por cotação" para "Até 150 produtos por cotação".
- `src/pages/LandingPage.tsx`: `proFeatures` — mesmo ajuste no texto de produtos por cotação.

### 3. Testes
- Ajustar os testes de planos que verificam o texto "100 produtos por cotação" para "150 produtos por cotação".

## Fora de escopo
- Preços, fornecedores, lojas, importação em massa, cotações simultâneas e demais planos.
- Qualquer alteração no algoritmo de cotação, seleção de fornecedores ou UI além dos textos listados.

## Critérios de aceitação
- Build verde; mobile 360px e desktop.
- Conta Pro: bloqueio no 151º produto da cotação; 150 produtos permitidos por cotação.
- Textos do plano Pro em `PlanosModal` e `LandingPage` exibem "150 produtos por cotação".
