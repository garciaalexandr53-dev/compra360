DROP POLICY IF EXISTS "Users see own fornecedores" ON public.fornecedores;

CREATE POLICY "Users see own fornecedores"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.fornecedor_lojas fl
    JOIN public.lojas l ON l.id = fl.loja_id
    WHERE fl.fornecedor_id = fornecedores.id
      AND l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users manage own fornecedor_lojas" ON public.fornecedor_lojas;

CREATE POLICY "Users manage own fornecedor_lojas"
ON public.fornecedor_lojas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE f.id = fornecedor_lojas.fornecedor_id
      AND f.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = fornecedor_lojas.loja_id
      AND l.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE f.id = fornecedor_lojas.fornecedor_id
      AND f.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = fornecedor_lojas.loja_id
      AND l.user_id = auth.uid()
  )
);