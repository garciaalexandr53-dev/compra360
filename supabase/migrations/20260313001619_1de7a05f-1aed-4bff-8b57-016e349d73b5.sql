
-- Allow anon to read fornecedores (needed to get name by id)
CREATE POLICY "Anon read fornecedores"
ON public.fornecedores FOR SELECT
TO anon
USING (true);

-- Allow anon to read precos
CREATE POLICY "Anon read precos"
ON public.precos FOR SELECT
TO anon
USING (true);

-- Allow anon to insert precos
CREATE POLICY "Anon insert precos"
ON public.precos FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to update precos
CREATE POLICY "Anon update precos"
ON public.precos FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
