CREATE OR REPLACE FUNCTION public.get_ultima_compra_item(
  _loja_id uuid,
  _catalogo_mestre_id uuid DEFAULT NULL,
  _ean text DEFAULT NULL,
  _nome text DEFAULT NULL
)
RETURNS TABLE(quantidade numeric, tipo_embalagem text, fator_embalagem integer, pedido_em timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ean_norm text := NULLIF(regexp_replace(COALESCE(_ean, ''), '\D', '', 'g'), '');
  _nome_norm text := NULLIF(lower(btrim(COALESCE(_nome, ''))), '');
BEGIN
  IF _loja_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cp.quantidade, cp.tipo_embalagem, cp.fator_embalagem, c.created_at
  FROM public.cotacao_produtos cp
  JOIN public.cotacoes c ON c.id = cp.cotacao_id
  WHERE c.loja_id = _loja_id
    AND cp.quantidade IS NOT NULL
    AND cp.quantidade > 0
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.cotacao_id = c.id AND p.status = 'enviado'::pedido_status
    )
    AND (
      (_catalogo_mestre_id IS NOT NULL AND cp.catalogo_mestre_id = _catalogo_mestre_id)
      OR (_ean_norm IS NOT NULL AND regexp_replace(COALESCE(cp.ean, ''), '\D', '', 'g') = _ean_norm)
      OR (_nome_norm IS NOT NULL AND lower(btrim(cp.nome)) = _nome_norm)
    )
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ultima_compra_item(uuid, uuid, text, text) TO anon, authenticated, service_role;