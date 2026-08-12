# Apertar o Free por cotação (não por cadastro)

## Objetivo
Inverter o gargalo do plano Free: em vez de limitar o cadastro de produtos e fornecedores, limitar quantos deles podem entrar em uma única cotação. Isso mantém o fluxo completo gratuito, mas força upgrade quando o cliente cresce de volume.

## Mudanças propostas

### 1. Redefinir os limites por cotação
Repurposear `max_produtos` e `max_fornecedores` da tabela `plans` para significar **por cotação**, não mais por catálogo.

| Plano | Lojas | Produtos/cotação | Fornecedores/cotação | Cotações simultâneas |
|---|---|---|---|---|
| Free | 1 | 25 | 4 | 1 |
| Pro | 3 | 500 | 30 | 3 |
| Business | ∞ | ∞ | ∞ | ∞ |

- Atualizar os registros da tabela `public.plans` via data update (não é migration de schema).
- Atualizar o fallback `FREE_PLAN` em `src/hooks/useSubscription.tsx` para refletir 25 produtos e 4 fornecedores por cotação.

### 2. Remover limites de cadastro
- `src/pages/ProdutosPage.tsx`: remover o `checkLimit("max_produtos", totalCount, ...)` que hoje bloqueia o cadastro de novos produtos.
- `src/pages/FornecedoresPage.tsx`: remover o `checkLimit("max_fornecedores", fornecedores.length, ...)` que bloqueia o cadastro de novos fornecedores.
- O catálogo local de produtos e fornecedores passa a ser ilimitado no Free; o gargalo passa a ser o uso dentro da cotação.

### 3. Adicionar validação por cotação no frontend
- `src/pages/AddProdutosCotacaoPage.tsx`: antes de inserir um produto na cotação ativa, contar quantos produtos já estão nela. Se o plano for Free e o limite de 25 for atingido, exibir o toast/upgrade modal.
- `src/pages/CotacaoPage.tsx` / `src/components/cotacao/ModalFornecedores.tsx`: antes de adicionar/selecionar um fornecedor para a cotação ativa, contar quantos fornecedores já estão nela. Se o plano for Free e o limite de 4 for atingido, exibir o toast/upgrade modal.
- Manter o `checkLimit` de `max_cotacoes_simultaneas` como está (impede uma segunda cotação ativa no Free).

### 4. Atualizar a comunicação dos planos
- `src/components/PlanosModal.tsx`: ajustar o texto do Free para "Até 25 produtos por cotação" e "Até 4 fornecedores por cotação".
- `src/pages/LandingPage.tsx`: corrigir a lista de features do Free (hoje está inconsistente: "3 fornecedores", "50 produtos", "2 cotações/mês") para refletir a nova regra.
- `src/hooks/useSubscription.tsx`: atualizar o array `features` do `FREE_PLAN`.

### 5. Dados existentes
- Cotações, produtos e fornecedores já cadastrados não serão removidos nem alterados.
- A regra passa a valer apenas para novos produtos/fornecedores adicionados a uma cotação após a mudança.

## Fora de escopo deste plano
- Não alterar preços dos planos.
- Não alterar os 30 dias grátis do Business.
- Não restringir funcionalidades que hoje estão no Free (IA de categorias, histórico, etc.).
- Não alterar o layout ou design fora do texto necessário.

## Critérios de aceitação
- Build verde.
- Mobile 360px e desktop funcionam.
- Usuário Free consegue cadastrar produtos e fornecedores sem limite, mas é bloqueado ao tentar adicionar o 26º produto ou 5º fornecedor na mesma cotação.
- Textos de PlanosModal e LandingPage refletem os novos limites.
