-- Allow anonymous users to read itens_faltantes scoped by loja_id
CREATE POLICY "Anon read itens_faltantes by loja"
ON public.itens_faltantes
FOR SELECT
TO anon
USING (loja_id IS NOT NULL);