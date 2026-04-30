-- Expand anon read policies to also allow 'finalizada' status (not only 'ativa').
-- Cancelled cotações remain hidden.

-- cotacoes
DROP POLICY IF EXISTS "Anon read cotacoes ativas" ON public.cotacoes;
CREATE POLICY "Anon read cotacoes acessiveis"
  ON public.cotacoes
  FOR SELECT
  TO anon
  USING (status IN ('ativa'::cotacao_status, 'finalizada'::cotacao_status));

-- cotacao_produtos
DROP POLICY IF EXISTS "Anon read cotacao_produtos" ON public.cotacao_produtos;
CREATE POLICY "Anon read cotacao_produtos"
  ON public.cotacao_produtos
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_produtos.cotacao_id
      AND c.status IN ('ativa'::cotacao_status, 'finalizada'::cotacao_status)
  ));

-- cotacao_fornecedores
DROP POLICY IF EXISTS "Anon read cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "Anon read cotacao_fornecedores"
  ON public.cotacao_fornecedores
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacao_fornecedores.cotacao_id
      AND c.status IN ('ativa'::cotacao_status, 'finalizada'::cotacao_status)
  ));

-- precos
DROP POLICY IF EXISTS "Anon read precos active" ON public.precos;
CREATE POLICY "Anon read precos acessiveis"
  ON public.precos
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.cotacao_produtos cp
    JOIN public.cotacoes c ON c.id = cp.cotacao_id
    WHERE cp.id = precos.cotacao_produto_id
      AND c.status IN ('ativa'::cotacao_status, 'finalizada'::cotacao_status)
  ));

-- produtos (catalog rows referenced by an accessible cotação)
DROP POLICY IF EXISTS "Anon read produtos in active cotacoes" ON public.produtos;
CREATE POLICY "Anon read produtos in cotacoes acessiveis"
  ON public.produtos
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1
    FROM public.cotacao_produtos cp
    JOIN public.cotacoes c ON c.id = cp.cotacao_id
    WHERE cp.produto_id = produtos.id
      AND c.status IN ('ativa'::cotacao_status, 'finalizada'::cotacao_status)
  ));