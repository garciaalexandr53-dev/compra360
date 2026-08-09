# Aviso inteligente de preço no portal do fornecedor

Hoje o portal público avisa preço estranho apenas por faixa fixa (< R$ 0,50 ou > R$ 999), o que não pega o erro mais comum: esquecer um dígito e o preço sair 100x menor. Vamos usar mediana de mercado como referência e mostrar o EAN para o fornecedor confirmar o item.

## 1. EAN ao lado do nome do produto

- Só aparece quando o snapshot da cotação tem EAN preenchido (hoje 124 de 1.337 itens têm). Sem EAN, nada é exibido.
- Formato discreto abaixo do nome, mesmo padrão visual usado no app do comprador.

## 2. Referência de preço (mediana)

Ordem de tentativa, por item:

1. **Mediana global** — mesmo produto do catálogo mestre, preços de todos os clientes, últimos 90 dias, considerada apenas se houver **3 ou mais fornecedores distintos** na amostra.
2. **Fallback do comprador** — quando o item é produto local (sem vínculo com catálogo mestre): mediana das cotações anteriores do próprio comprador, mesma exigência de 3 fornecedores distintos.
3. **Sem amostra** — mantém a faixa fixa atual (< 0,50 / > 999) como último recurso.

Preços zerados ("sem itens") ficam fora da amostra.

## 3. Aviso

- Divergência maior que 20% acima ou abaixo da mediana de referência → aviso "Valor fora do padrão — confirme se está correto", com a referência mostrada (ex.: "referência de mercado: R$ 9,30").
- **Nunca bloqueia o envio.** Continua sendo só um aviso.

## Detalhes técnicos

**Migração (uma só):**

- `DROP FUNCTION public.get_supplier_cotacao_produtos(text, uuid)` — necessário porque o tipo de retorno muda de 5 para 8 colunas (`CREATE OR REPLACE` não permite).
- Recriar com as colunas novas: `produto_ean`, `preco_referencia numeric`, `referencia_fonte text` (`global` | `comprador` | `null`), mantendo a mesma checagem de token/cotação ativa e `SECURITY DEFINER` + `SET search_path = public`.
- Mediana via `percentile_cont(0.5)` sobre `precos` → `cotacao_produtos` → `cotacoes` (últimos 90 dias, `preco > 0`), agrupada por `catalogo_mestre_id` na variante global e por `cotacoes.created_by` na variante do comprador; retorna `NULL` quando `count(distinct fornecedor_id) < 3`.
- **Permissões (confirmado no banco antes do drop):** hoje a função tem EXECUTE para `PUBLIC`, `anon`, `authenticated`, `service_role`. O drop apaga isso e o portal quebraria silenciosamente, então a mesma migração reaplica:
  `GRANT EXECUTE ON FUNCTION public.get_supplier_cotacao_produtos(text, uuid) TO anon, authenticated, service_role;`

**Front — `src/pages/FornecedorCotacaoPage.tsx`:**

- Ler os 3 campos novos da RPC e guardá-los no item.
- Substituir a checagem de faixa fixa por um helper puro em `src/lib/` (`avaliarPreco`), com testes cobrindo: divergência acima, abaixo, dentro da tolerância, e ausência de referência (cai na faixa fixa).
- Nenhuma mudança em `submit-precos`, no fluxo "Sem itens" ou nas telas de prazo/encerrada.

**Verificação:** build/typecheck verdes, testes existentes de `FornecedorCotacaoPage` (que proíbem acesso direto a tabelas) continuam passando, e layout conferido em 360px e desktop.
