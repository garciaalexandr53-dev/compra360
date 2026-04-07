-- Fix fornecedor_lojas: remove IS NULL bypass
DROP POLICY IF EXISTS "Users manage own fornecedor_lojas" ON public.fornecedor_lojas;

CREATE POLICY "Users manage own fornecedor_lojas"
ON public.fornecedor_lojas
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM fornecedores f
  WHERE f.id = fornecedor_lojas.fornecedor_id
  AND f.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM fornecedores f
  WHERE f.id = fornecedor_lojas.fornecedor_id
  AND f.user_id = auth.uid()
));

-- Fix itens_faltantes: remove IS NULL bypass from ALL policies
DROP POLICY IF EXISTS "Users manage own itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Users manage own itens_faltantes"
ON public.itens_faltantes
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM lojas l
  WHERE l.id = itens_faltantes.loja_id
  AND l.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM lojas l
  WHERE l.id = itens_faltantes.loja_id
  AND l.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Auth read itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Auth read itens_faltantes"
ON public.itens_faltantes
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM lojas l
  WHERE l.id = itens_faltantes.loja_id
  AND l.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Auth insert itens_faltantes" ON public.itens_faltantes;

CREATE POLICY "Auth insert itens_faltantes"
ON public.itens_faltantes
FOR INSERT
TO authenticated
WITH CHECK (
  loja_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM lojas l
    WHERE l.id = itens_faltantes.loja_id
    AND l.user_id = auth.uid()
  )
);