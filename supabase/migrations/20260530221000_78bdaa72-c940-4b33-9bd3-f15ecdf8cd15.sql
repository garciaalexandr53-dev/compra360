
-- 1. New SECURITY DEFINER RPC for supplier cotacao products
CREATE OR REPLACE FUNCTION public.get_supplier_cotacao_produtos(_token text, _cotacao_id uuid)
RETURNS TABLE(
  id uuid,
  quantidade numeric,
  fator_embalagem integer,
  produto_nome text,
  produto_embalagem text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier_id uuid;
BEGIN
  SELECT f.id INTO _supplier_id FROM public.fornecedores f WHERE f.token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN; END IF;

  -- Ensure supplier is linked to this cotação and it is active
  IF NOT EXISTS (
    SELECT 1 FROM public.cotacao_fornecedores cf
    JOIN public.cotacoes c ON c.id = cf.cotacao_id
    WHERE cf.cotacao_id = _cotacao_id
      AND cf.fornecedor_id = _supplier_id
      AND c.status = 'ativa'::cotacao_status
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cp.id, cp.quantidade, cp.fator_embalagem, p.nome, p.embalagem
    FROM public.cotacao_produtos cp
    JOIN public.produtos p ON p.id = cp.produto_id
    WHERE cp.cotacao_id = _cotacao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_cotacao_produtos(text, uuid) TO anon, authenticated;

-- 2. Drop anonymous SELECT policies that allowed cross-tenant enumeration
DROP POLICY IF EXISTS "Anon read cotacao_produtos" ON public.cotacao_produtos;
DROP POLICY IF EXISTS "Anon read produtos in cotacoes ativas" ON public.produtos;
DROP POLICY IF EXISTS "Anon read categorias in active cotacoes" ON public.categorias;
