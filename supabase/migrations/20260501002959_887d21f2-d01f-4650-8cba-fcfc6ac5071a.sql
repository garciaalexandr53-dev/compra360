-- Revert anon access to only 'ativa' status (block 'finalizada' and 'cancelada')

DROP POLICY IF EXISTS "Anon read cotacoes acessiveis" ON public.cotacoes;
CREATE POLICY "Anon read cotacoes ativas"
  ON public.cotacoes FOR SELECT TO anon
  USING (status = 'ativa'::cotacao_status);

DROP POLICY IF EXISTS "Anon read cotacao_produtos" ON public.cotacao_produtos;
CREATE POLICY "Anon read cotacao_produtos"
  ON public.cotacao_produtos FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_produtos.cotacao_id AND c.status = 'ativa'::cotacao_status
  ));

DROP POLICY IF EXISTS "Anon read cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "Anon read cotacao_fornecedores"
  ON public.cotacao_fornecedores FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_fornecedores.cotacao_id AND c.status = 'ativa'::cotacao_status
  ));

DROP POLICY IF EXISTS "Anon read precos acessiveis" ON public.precos;
CREATE POLICY "Anon read precos ativas"
  ON public.precos FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacao_produtos cp
    JOIN public.cotacoes c ON c.id = cp.cotacao_id
    WHERE cp.id = precos.cotacao_produto_id AND c.status = 'ativa'::cotacao_status
  ));

DROP POLICY IF EXISTS "Anon read produtos in cotacoes acessiveis" ON public.produtos;
CREATE POLICY "Anon read produtos in cotacoes ativas"
  ON public.produtos FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacao_produtos cp
    JOIN public.cotacoes c ON c.id = cp.cotacao_id
    WHERE cp.produto_id = produtos.id AND c.status = 'ativa'::cotacao_status
  ));

-- Add RPC for supplier to check cotação status (works even when finalizada, bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_cotacao_status_for_supplier(_token text, _loja_id uuid DEFAULT NULL)
RETURNS TABLE(cotacao_id uuid, status text, loja_id uuid, loja_nome text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier_id uuid;
BEGIN
  SELECT id INTO _supplier_id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT c.id, c.status::text, c.loja_id, l.nome
  FROM public.cotacoes c
  JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = c.id
  LEFT JOIN public.lojas l ON l.id = c.loja_id
  WHERE cf.fornecedor_id = _supplier_id
    AND (_loja_id IS NULL OR c.loja_id = _loja_id)
  ORDER BY 
    CASE WHEN c.status = 'ativa' THEN 0 ELSE 1 END,
    c.created_at DESC
  LIMIT 1;
END;
$$;