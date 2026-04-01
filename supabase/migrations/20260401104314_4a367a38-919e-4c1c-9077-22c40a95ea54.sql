
-- === LOJAS ===
DROP POLICY IF EXISTS "Users see own lojas" ON public.lojas;
CREATE POLICY "Users see own lojas" ON public.lojas FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own lojas" ON public.lojas;
CREATE POLICY "Users update own lojas" ON public.lojas FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own lojas" ON public.lojas;
CREATE POLICY "Users delete own lojas" ON public.lojas FOR DELETE TO authenticated USING (user_id = auth.uid());

-- === CATEGORIAS ===
DROP POLICY IF EXISTS "Users see own categorias" ON public.categorias;
CREATE POLICY "Users see own categorias" ON public.categorias FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own categorias" ON public.categorias;
CREATE POLICY "Users update own categorias" ON public.categorias FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own categorias" ON public.categorias;
CREATE POLICY "Users delete own categorias" ON public.categorias FOR DELETE TO authenticated USING (user_id = auth.uid());

-- === PRODUTOS ===
DROP POLICY IF EXISTS "Users see own produtos" ON public.produtos;
CREATE POLICY "Users see own produtos" ON public.produtos FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own produtos" ON public.produtos;
CREATE POLICY "Users update own produtos" ON public.produtos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own produtos" ON public.produtos;
CREATE POLICY "Users delete own produtos" ON public.produtos FOR DELETE TO authenticated USING (user_id = auth.uid());

-- === PEDIDOS ===
DROP POLICY IF EXISTS "Users see own pedidos" ON public.pedidos;
CREATE POLICY "Users see own pedidos" ON public.pedidos FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users update own pedidos" ON public.pedidos;
CREATE POLICY "Users update own pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users delete own pedidos" ON public.pedidos;
CREATE POLICY "Users delete own pedidos" ON public.pedidos FOR DELETE TO authenticated USING (created_by = auth.uid());

-- === COTACOES ===
DROP POLICY IF EXISTS "Users see own cotacoes" ON public.cotacoes;
CREATE POLICY "Users see own cotacoes" ON public.cotacoes FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users update own cotacoes" ON public.cotacoes;
CREATE POLICY "Users update own cotacoes" ON public.cotacoes FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users delete own cotacoes" ON public.cotacoes;
CREATE POLICY "Users delete own cotacoes" ON public.cotacoes FOR DELETE TO authenticated USING (created_by = auth.uid());

-- === COTACAO_PRODUTOS (via cotacoes.created_by) ===
DROP POLICY IF EXISTS "Users manage own cotacao_produtos" ON public.cotacao_produtos;
CREATE POLICY "Users manage own cotacao_produtos" ON public.cotacao_produtos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_produtos.cotacao_id AND cotacoes.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_produtos.cotacao_id AND cotacoes.created_by = auth.uid()));

-- === COTACAO_FORNECEDORES (via cotacoes.created_by) ===
DROP POLICY IF EXISTS "Users manage own cotacao_fornecedores" ON public.cotacao_fornecedores;
CREATE POLICY "Users manage own cotacao_fornecedores" ON public.cotacao_fornecedores FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND cotacoes.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND cotacoes.created_by = auth.uid()));

-- === PRECOS (via cotacao_produtos -> cotacoes.created_by) ===
DROP POLICY IF EXISTS "Users manage own precos" ON public.precos;
CREATE POLICY "Users manage own precos" ON public.precos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM cotacao_produtos cp JOIN cotacoes c ON c.id = cp.cotacao_id WHERE cp.id = precos.cotacao_produto_id AND c.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM cotacao_produtos cp JOIN cotacoes c ON c.id = cp.cotacao_id WHERE cp.id = precos.cotacao_produto_id AND c.created_by = auth.uid()));

-- === CONFERENCIAS (via pedidos.created_by) ===
DROP POLICY IF EXISTS "Users manage own conferencias" ON public.conferencias;
CREATE POLICY "Users manage own conferencias" ON public.conferencias FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = conferencias.pedido_id AND p.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = conferencias.pedido_id AND p.created_by = auth.uid()));

-- === CONFERENCIA_ITENS (via conferencias -> pedidos.created_by) ===
DROP POLICY IF EXISTS "Users manage own conferencia_itens" ON public.conferencia_itens;
CREATE POLICY "Users manage own conferencia_itens" ON public.conferencia_itens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM conferencias conf JOIN pedidos p ON p.id = conf.pedido_id WHERE conf.id = conferencia_itens.conferencia_id AND p.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM conferencias conf JOIN pedidos p ON p.id = conf.pedido_id WHERE conf.id = conferencia_itens.conferencia_id AND p.created_by = auth.uid()));

-- === FORNECEDOR_LOJAS: restrict anon read to only the supplier's own mappings ===
DROP POLICY IF EXISTS "Anon read fornecedor_lojas" ON public.fornecedor_lojas;
