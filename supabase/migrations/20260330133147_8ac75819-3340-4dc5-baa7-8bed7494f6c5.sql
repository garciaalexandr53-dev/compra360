
-- Fix 1: Remove anon read on fornecedores (exposes tokens + contact info to all)
DROP POLICY IF EXISTS "Anon read fornecedores" ON public.fornecedores;

-- Fix 2: Remove unrestricted anon write on precos
DROP POLICY IF EXISTS "Anon insert precos" ON public.precos;
DROP POLICY IF EXISTS "Anon update precos" ON public.precos;

-- Fix 3: Create secure RPC to get supplier info from token (no token exposure)
CREATE OR REPLACE FUNCTION public.get_supplier_info(_token text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.nome FROM public.fornecedores f WHERE f.token = _token LIMIT 1
$$;
