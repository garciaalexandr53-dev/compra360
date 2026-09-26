CREATE OR REPLACE FUNCTION public.get_historico_precos_loja(_loja_id uuid)
RETURNS TABLE(chave text, ultimo_preco numeric, ultimo_fornecedor text, ultima_data timestamptz, media numeric, amostras integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lojas WHERE id = _loja_id AND user_id = auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH cots AS (
    SELECT c.id, COALESCE(c.finalizada_at, c.created_at) AS dt
    FROM cotacoes c
    WHERE c.loja_id = _loja_id AND c.status = 'finalizada'
      AND EXISTS (SELECT 1 FROM pedidos p WHERE p.cotacao_id = c.id)
    ORDER BY COALESCE(c.finalizada_at, c.created_at) DESC
    LIMIT 5
  ),
  itens AS (
    SELECT DISTINCT ON (cots.id, k.chave)
      k.chave, cots.dt, pr.preco / GREATEST(cp.fator_embalagem,1) AS unit, f.nome AS forn
    FROM cots
    JOIN cotacao_produtos cp ON cp.cotacao_id = cots.id
    CROSS JOIN LATERAL (SELECT CASE
      WHEN cp.catalogo_mestre_id IS NOT NULL THEN 'c:'||cp.catalogo_mestre_id::text
      WHEN NULLIF(trim(cp.ean),'') IS NOT NULL THEN 'e:'||trim(cp.ean)
      ELSE 'n:'||lower(trim(cp.nome)) END AS chave) k
    JOIN precos pr ON pr.cotacao_produto_id = cp.id AND pr.preco > 0
    JOIN fornecedores f ON f.id = pr.fornecedor_id
    ORDER BY cots.id, k.chave, pr.preco ASC
  )
  SELECT i.chave,
    (array_agg(i.unit ORDER BY i.dt DESC))[1],
    (array_agg(i.forn ORDER BY i.dt DESC))[1],
    max(i.dt),
    avg(i.unit),
    count(*)::int
  FROM itens i
  GROUP BY i.chave
  HAVING count(*) >= 2;
END;
$$;
REVOKE ALL ON FUNCTION public.get_historico_precos_loja(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_historico_precos_loja(uuid) TO authenticated;