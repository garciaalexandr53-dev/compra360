
-- 1. Create public view for lojas (only id + nome, no sensitive data)
CREATE VIEW public.lojas_public AS
SELECT id, nome FROM public.lojas;

GRANT SELECT ON public.lojas_public TO anon;
GRANT SELECT ON public.lojas_public TO authenticated;

-- Drop broad anon read on lojas (exposes CNPJ, address, etc.)
DROP POLICY IF EXISTS "Anon read lojas" ON public.lojas;

-- 2. Create secure function to get owner user_id from loja (for product filtering)
CREATE OR REPLACE FUNCTION public.get_loja_owner(_loja_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM public.lojas WHERE id = _loja_id LIMIT 1
$$;

-- 3. Tighten precos anon read: only for active cotações
DROP POLICY IF EXISTS "Anon read precos" ON public.precos;

CREATE POLICY "Anon read precos active" ON public.precos
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM cotacao_produtos cp
  JOIN cotacoes c ON c.id = cp.cotacao_id
  WHERE cp.id = precos.cotacao_produto_id AND c.status = 'ativa'
));

-- 4. Tighten itens_faltantes: require loja_id on anon insert, remove anon read
DROP POLICY IF EXISTS "Anyone can read itens_faltantes" ON public.itens_faltantes;
DROP POLICY IF EXISTS "Anyone can insert itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Anon insert itens_faltantes with loja" ON public.itens_faltantes
FOR INSERT TO anon
WITH CHECK (loja_id IS NOT NULL);

CREATE POLICY "Auth insert itens_faltantes" ON public.itens_faltantes
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth read itens_faltantes" ON public.itens_faltantes
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM lojas l
  WHERE l.id = itens_faltantes.loja_id AND (l.user_id = auth.uid() OR l.user_id IS NULL)
));
