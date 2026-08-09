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

GRANT EXECUTE ON FUNCTION public.get_supplier_cotacao_produtos(text, uuid)
  TO anon, authenticated, service_role;