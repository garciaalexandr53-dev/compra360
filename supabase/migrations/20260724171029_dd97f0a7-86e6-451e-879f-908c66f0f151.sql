DROP POLICY IF EXISTS "Anon insert itens_faltantes with valid loja" ON public.itens_faltantes;
DROP POLICY IF EXISTS "Auth insert itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Public insert itens_faltantes with valid loja"
ON public.itens_faltantes
FOR INSERT
TO anon, authenticated
WITH CHECK (loja_id IS NOT NULL AND public.loja_exists(loja_id));