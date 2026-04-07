-- Fix 1: Restrict anon read on produtos to only products in active cotações
DROP POLICY IF EXISTS "Anon read produtos" ON public.produtos;

CREATE POLICY "Anon read produtos in active cotacoes"
ON public.produtos
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM cotacao_produtos cp
  JOIN cotacoes c ON c.id = cp.cotacao_id
  WHERE cp.produto_id = produtos.id AND c.status = 'ativa'
));

-- Fix 2: Restrict anon read on categorias to only categories used in active cotações
DROP POLICY IF EXISTS "Anon read categorias" ON public.categorias;

CREATE POLICY "Anon read categorias in active cotacoes"
ON public.categorias
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM produtos p
  JOIN cotacao_produtos cp ON cp.produto_id = p.id
  JOIN cotacoes c ON c.id = cp.cotacao_id
  WHERE p.categoria_id = categorias.id AND c.status = 'ativa'
));