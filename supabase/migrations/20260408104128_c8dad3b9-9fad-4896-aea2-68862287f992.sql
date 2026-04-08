-- Drop the overly permissive anon insert policy
DROP POLICY IF EXISTS "Anon insert itens_faltantes with loja" ON public.itens_faltantes;

-- Create a tighter policy that verifies loja actually exists
CREATE POLICY "Anon insert itens_faltantes with valid loja"
ON public.itens_faltantes
FOR INSERT
TO anon
WITH CHECK (
  loja_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = itens_faltantes.loja_id)
);