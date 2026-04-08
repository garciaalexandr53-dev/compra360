-- Drop the broken policy
DROP POLICY IF EXISTS "Anon read produtos by loja owner" ON public.produtos;

-- Create a SECURITY DEFINER function that bypasses lojas RLS
CREATE OR REPLACE FUNCTION public.produto_belongs_to_loja_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lojas WHERE lojas.user_id = _user_id
  )
$$;

-- Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "Anon read produtos by loja owner"
ON public.produtos FOR SELECT TO anon
USING (public.produto_belongs_to_loja_owner(user_id));
