
-- Re-add the policy - needed for App Funcionários to browse products
-- The function produto_belongs_to_loja_owner checks that the product's user_id owns at least one loja
CREATE POLICY "Anon read produtos by loja owner"
  ON public.produtos
  FOR SELECT
  TO anon
  USING (produto_belongs_to_loja_owner(user_id));
