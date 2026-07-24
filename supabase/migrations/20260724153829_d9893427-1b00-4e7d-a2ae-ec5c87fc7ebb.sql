
CREATE POLICY "Users select own cotacao_fornecedores" ON public.cotacao_fornecedores
FOR SELECT USING (EXISTS (SELECT 1 FROM public.cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND cotacoes.created_by = auth.uid()));

CREATE POLICY "Users select own cotacao_produtos" ON public.cotacao_produtos
FOR SELECT USING (EXISTS (SELECT 1 FROM public.cotacoes WHERE cotacoes.id = cotacao_produtos.cotacao_id AND cotacoes.created_by = auth.uid()));

CREATE POLICY "Users select own precos" ON public.precos
FOR SELECT USING (EXISTS (SELECT 1 FROM public.cotacao_produtos cp JOIN public.cotacoes c ON c.id = cp.cotacao_id WHERE cp.id = precos.cotacao_produto_id AND c.created_by = auth.uid()));
