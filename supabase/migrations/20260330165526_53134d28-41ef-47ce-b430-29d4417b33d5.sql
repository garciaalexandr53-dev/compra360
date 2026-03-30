
-- Fix SECURITY DEFINER view issue
DROP VIEW IF EXISTS public.lojas_public;
CREATE VIEW public.lojas_public WITH (security_invoker = true) AS
SELECT id, nome FROM public.lojas;

GRANT SELECT ON public.lojas_public TO anon;
GRANT SELECT ON public.lojas_public TO authenticated;

-- Need a permissive SELECT policy on lojas for the view to work with security_invoker
CREATE POLICY "Anon read lojas public fields" ON public.lojas
FOR SELECT TO anon
USING (true);

-- Fix overly permissive Auth insert - scope to user's lojas
DROP POLICY IF EXISTS "Auth insert itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Auth insert itens_faltantes" ON public.itens_faltantes
FOR INSERT TO authenticated
WITH CHECK (
  loja_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM lojas l WHERE l.id = itens_faltantes.loja_id AND (l.user_id = auth.uid() OR l.user_id IS NULL)
  )
);
