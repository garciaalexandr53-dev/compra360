
CREATE POLICY "Anon read produtos by loja owner"
ON public.produtos FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.lojas
  WHERE lojas.user_id = produtos.user_id
));
