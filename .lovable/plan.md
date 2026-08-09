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

**Migração (uma só) — SQL exato a ser aplicado:**

```sql
DROP FUNCTION IF EXISTS public.get_supplier_cotacao_produtos(text, uuid);

CREATE FUNCTION public.get_supplier_cotacao_produtos(_token text, _cotacao_id uuid)
RETURNS TABLE(
  id uuid,
  quantidade numeric,
  fator_embalagem integer,
  produto_nome text,
  produto_embalagem text,
  produto_ean text,
  preco_referencia numeric,
  referencia_fonte text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier_id uuid;
  _owner uuid;
BEGIN
  SELECT f.id INTO _supplier_id FROM public.fornecedores f WHERE f.token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN; END IF;

  -- mesma checagem de autorização de hoje: token vinculado à cotação e cotação ativa
  IF NOT EXISTS (
    SELECT 1 FROM public.cotacao_fornecedores cf
    JOIN public.cotacoes c ON c.id = cf.cotacao_id
    WHERE cf.cotacao_id = _cotacao_id
      AND cf.fornecedor_id = _supplier_id
      AND c.status = 'ativa'::cotacao_status
  ) THEN
    RETURN;
  END IF;

  SELECT c.created_by INTO _owner FROM public.cotacoes c WHERE c.id = _cotacao_id;

  RETURN QUERY
  SELECT
    cp.id,
    cp.quantidade,
    cp.fator_embalagem,
    cp.nome AS produto_nome,
    coalesce(cp.tipo_embalagem, p.embalagem) AS produto_embalagem,
    cp.ean AS produto_ean,
    ref.mediana AS preco_referencia,
    ref.fonte   AS referencia_fonte
  FROM public.cotacao_produtos cp
  LEFT JOIN public.produtos p ON p.id = cp.produto_id
  LEFT JOIN LATERAL (
    -- 1) mediana GLOBAL: mesmo item do catálogo mestre, todos os clientes, 90 dias
    SELECT g.mediana, 'global'::text AS fonte
    FROM (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY pr.preco) AS mediana,
             count(DISTINCT pr.fornecedor_id) AS n_forn
      FROM public.precos pr
      JOIN public.cotacao_produtos cp2 ON cp2.id = pr.cotacao_produto_id
      JOIN public.cotacoes c2 ON c2.id = cp2.cotacao_id
      WHERE cp.catalogo_mestre_id IS NOT NULL
        AND cp2.catalogo_mestre_id = cp.catalogo_mestre_id
        AND cp2.cotacao_id <> _cotacao_id
        AND pr.preco > 0
        AND c2.created_at >= now() - interval '90 days'
    ) g
    WHERE g.mediana IS NOT NULL AND g.n_forn >= 3

    UNION ALL

    -- 2) fallback COMPRADOR: item local (sem catálogo mestre), cotações do próprio dono
    SELECT b.mediana, 'comprador'::text AS fonte
    FROM (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY pr.preco) AS mediana,
             count(DISTINCT pr.fornecedor_id) AS n_forn
      FROM public.precos pr
      JOIN public.cotacao_produtos cp2 ON cp2.id = pr.cotacao_produto_id
      JOIN public.cotacoes c2 ON c2.id = cp2.cotacao_id
      WHERE cp.catalogo_mestre_id IS NULL
        AND c2.created_by = _owner
        AND cp2.cotacao_id <> _cotacao_id
        AND lower(btrim(cp2.nome)) = lower(btrim(cp.nome))
        AND pr.preco > 0
        AND c2.created_at >= now() - interval '90 days'
    ) b
    WHERE b.mediana IS NOT NULL AND b.n_forn >= 3

    LIMIT 1
  ) ref ON true
  WHERE cp.cotacao_id = _cotacao_id;
END;
$$;

-- reaplica as permissões apagadas pelo DROP (estado atual confirmado no banco:
-- EXECUTE para PUBLIC, anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.get_supplier_cotacao_produtos(text, uuid)
  TO anon, authenticated, service_role;
```

Notas sobre as cláusulas da variante comprador:

- `cp.catalogo_mestre_id IS NULL` garante que ela só roda quando o item é produto local — itens do catálogo usam a variante global.
- O casamento é por nome normalizado (`lower(btrim(...))`) porque o item local pode ter `produto_id` diferente entre cotações; ainda assim é escopo do próprio dono via `c2.created_by = _owner`.
- Não há `GROUP BY`: cada subconsulta é uma agregação única (uma linha), avaliada por item via `LATERAL`; o filtro de amostra vira `HAVING`-equivalente no `WHERE` externo da subconsulta (`n_forn >= 3`).
- `cp2.cotacao_id <> _cotacao_id` exclui a própria cotação em andamento, para o fornecedor não ser comparado com os preços já digitados nela.
- `LIMIT 1` no `LATERAL` implementa a precedência: global primeiro, comprador depois, nenhum → `NULL` (front cai na faixa fixa).


**Front — `src/pages/FornecedorCotacaoPage.tsx`:**

- Ler os 3 campos novos da RPC e guardá-los no item.
- Substituir a checagem de faixa fixa por um helper puro em `src/lib/` (`avaliarPreco`), com testes cobrindo: divergência acima, abaixo, dentro da tolerância, e ausência de referência (cai na faixa fixa).
- Nenhuma mudança em `submit-precos`, no fluxo "Sem itens" ou nas telas de prazo/encerrada.

**Verificação:** build/typecheck verdes, testes existentes de `FornecedorCotacaoPage` (que proíbem acesso direto a tabelas) continuam passando, e layout conferido em 360px e desktop.
