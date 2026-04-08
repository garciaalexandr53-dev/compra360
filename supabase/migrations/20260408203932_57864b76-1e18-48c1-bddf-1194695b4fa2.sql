
-- Function to check loja exists, bypassing lojas RLS
CREATE OR REPLACE FUNCTION public.loja_exists(_loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.lojas WHERE id = _loja_id)
$$;

-- Fix anon INSERT policy
DROP POLICY IF EXISTS "Anon insert itens_faltantes with valid loja" ON public.itens_faltantes;
CREATE POLICY "Anon insert itens_faltantes with valid loja"
ON public.itens_faltantes FOR INSERT TO anon
WITH CHECK (loja_id IS NOT NULL AND public.loja_exists(loja_id));

-- Fix anon SELECT policy too (same nested RLS issue)
DROP POLICY IF EXISTS "Anon read itens_faltantes by loja" ON public.itens_faltantes;
CREATE POLICY "Anon read itens_faltantes by loja"
ON public.itens_faltantes FOR SELECT TO anon
USING (loja_id IS NOT NULL AND public.loja_exists(loja_id));
