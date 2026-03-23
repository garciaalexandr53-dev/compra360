
-- Add user_id to core tables
ALTER TABLE public.lojas ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fornecedores ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.produtos ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.categorias ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old RLS policies on lojas
DROP POLICY IF EXISTS "Buyers full access lojas" ON public.lojas;
DROP POLICY IF EXISTS "Anon read lojas" ON public.lojas;

-- New RLS for lojas: users see only their own data
CREATE POLICY "Users see own lojas" ON public.lojas FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users insert own lojas" ON public.lojas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own lojas" ON public.lojas FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own lojas" ON public.lojas FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Anon read lojas" ON public.lojas FOR SELECT TO anon USING (true);

-- Drop old RLS policies on fornecedores
DROP POLICY IF EXISTS "Buyers full access fornecedores" ON public.fornecedores;

-- New RLS for fornecedores
CREATE POLICY "Users see own fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users insert own fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- Drop old RLS policies on produtos
DROP POLICY IF EXISTS "Buyers full access produtos" ON public.produtos;

-- New RLS for produtos
CREATE POLICY "Users see own produtos" ON public.produtos FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users insert own produtos" ON public.produtos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own produtos" ON public.produtos FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own produtos" ON public.produtos FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- Drop old RLS policies on categorias
DROP POLICY IF EXISTS "Buyers full access categorias" ON public.categorias;

-- New RLS for categorias
CREATE POLICY "Users see own categorias" ON public.categorias FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users insert own categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own categorias" ON public.categorias FOR UPDATE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own categorias" ON public.categorias FOR DELETE TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);

-- Update cotacoes RLS to use created_by
DROP POLICY IF EXISTS "Buyers full access cotacoes" ON public.cotacoes;
CREATE POLICY "Users see own cotacoes" ON public.cotacoes FOR SELECT TO authenticated USING (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "Users insert own cotacoes" ON public.cotacoes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update own cotacoes" ON public.cotacoes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users delete own cotacoes" ON public.cotacoes FOR DELETE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL);

-- Update pedidos RLS to use created_by
DROP POLICY IF EXISTS "Buyers full access pedidos" ON public.pedidos;
CREATE POLICY "Users see own pedidos" ON public.pedidos FOR SELECT TO authenticated USING (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "Users insert own pedidos" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users update own pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users delete own pedidos" ON public.pedidos FOR DELETE TO authenticated USING (created_by = auth.uid() OR created_by IS NULL);

-- Update cotacao_fornecedores RLS
DROP POLICY IF EXISTS "Buyers full access cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "Users manage own cotacao_fornecedores" ON public.cotacao_fornecedores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND (cotacoes.created_by = auth.uid() OR cotacoes.created_by IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND (cotacoes.created_by = auth.uid() OR cotacoes.created_by IS NULL)));

-- Update cotacao_produtos RLS
DROP POLICY IF EXISTS "Buyers full access cotacao_produtos" ON public.cotacao_produtos;
CREATE POLICY "Users manage own cotacao_produtos" ON public.cotacao_produtos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_produtos.cotacao_id AND (cotacoes.created_by = auth.uid() OR cotacoes.created_by IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_produtos.cotacao_id AND (cotacoes.created_by = auth.uid() OR cotacoes.created_by IS NULL)));

-- Update precos RLS
DROP POLICY IF EXISTS "Buyers full access precos" ON public.precos;
CREATE POLICY "Users manage own precos" ON public.precos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM cotacao_produtos cp JOIN cotacoes c ON c.id = cp.cotacao_id WHERE cp.id = precos.cotacao_produto_id AND (c.created_by = auth.uid() OR c.created_by IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM cotacao_produtos cp JOIN cotacoes c ON c.id = cp.cotacao_id WHERE cp.id = precos.cotacao_produto_id AND (c.created_by = auth.uid() OR c.created_by IS NULL)));

-- Update conferencias RLS
DROP POLICY IF EXISTS "Buyers full access conferencias" ON public.conferencias;
CREATE POLICY "Users manage own conferencias" ON public.conferencias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = conferencias.pedido_id AND (p.created_by = auth.uid() OR p.created_by IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = conferencias.pedido_id AND (p.created_by = auth.uid() OR p.created_by IS NULL)));

-- Update conferencia_itens RLS
DROP POLICY IF EXISTS "Buyers full access conferencia_itens" ON public.conferencia_itens;
CREATE POLICY "Users manage own conferencia_itens" ON public.conferencia_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM conferencias conf JOIN pedidos p ON p.id = conf.pedido_id WHERE conf.id = conferencia_itens.conferencia_id AND (p.created_by = auth.uid() OR p.created_by IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM conferencias conf JOIN pedidos p ON p.id = conf.pedido_id WHERE conf.id = conferencia_itens.conferencia_id AND (p.created_by = auth.uid() OR p.created_by IS NULL)));

-- Update fornecedor_lojas RLS
DROP POLICY IF EXISTS "Buyers full access fornecedor_lojas" ON public.fornecedor_lojas;
CREATE POLICY "Users manage own fornecedor_lojas" ON public.fornecedor_lojas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fornecedores f WHERE f.id = fornecedor_lojas.fornecedor_id AND (f.user_id = auth.uid() OR f.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM fornecedores f WHERE f.id = fornecedor_lojas.fornecedor_id AND (f.user_id = auth.uid() OR f.user_id IS NULL)));

-- Update itens_faltantes RLS
DROP POLICY IF EXISTS "Buyers manage itens_faltantes" ON public.itens_faltantes;
CREATE POLICY "Users manage own itens_faltantes" ON public.itens_faltantes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM lojas l WHERE l.id = itens_faltantes.loja_id AND (l.user_id = auth.uid() OR l.user_id IS NULL)))
  WITH CHECK (EXISTS (SELECT 1 FROM lojas l WHERE l.id = itens_faltantes.loja_id AND (l.user_id = auth.uid() OR l.user_id IS NULL)));
