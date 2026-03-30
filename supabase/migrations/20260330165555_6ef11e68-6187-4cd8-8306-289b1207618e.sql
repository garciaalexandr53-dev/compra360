
-- Remove the broad anon read we just added (it still exposes all columns)
DROP POLICY IF EXISTS "Anon read lojas public fields" ON public.lojas;

-- Drop the view since we'll use RPC instead
DROP VIEW IF EXISTS public.lojas_public;

-- Create RPC to get public loja info (id + nome only)
CREATE OR REPLACE FUNCTION public.get_lojas_public(_loja_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.id, l.nome FROM public.lojas l
  WHERE (_loja_id IS NULL OR l.id = _loja_id)
  ORDER BY l.nome
$$;
