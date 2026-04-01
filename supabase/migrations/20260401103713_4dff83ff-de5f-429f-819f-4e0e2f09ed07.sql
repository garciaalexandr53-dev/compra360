
-- Fix 1: Drop overly permissive anon read on conferencia_itens (USING: true)
DROP POLICY IF EXISTS "Anon read conferencia_itens" ON public.conferencia_itens;

-- Replace with scoped policy: anon can only read items for 'enviado' pedidos (needed by employee app)
CREATE POLICY "Anon read conferencia_itens scoped"
ON public.conferencia_itens
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM conferencias conf
    JOIN pedidos p ON p.id = conf.pedido_id
    WHERE conf.id = conferencia_itens.conferencia_id
      AND p.status = 'enviado'::pedido_status
  )
);

-- Fix 2: Drop overly permissive anon read on conferencias (USING: true)
DROP POLICY IF EXISTS "Anon read conferencias" ON public.conferencias;

-- Replace with scoped policy
CREATE POLICY "Anon read conferencias scoped"
ON public.conferencias
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM pedidos p
    WHERE p.id = conferencias.pedido_id
      AND p.status = 'enviado'::pedido_status
  )
);

-- Fix 3: Tighten fornecedores SELECT to remove user_id IS NULL fallback (prevents token leakage)
DROP POLICY IF EXISTS "Users see own fornecedores" ON public.fornecedores;

CREATE POLICY "Users see own fornecedores"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Also tighten UPDATE and DELETE to be consistent
DROP POLICY IF EXISTS "Users update own fornecedores" ON public.fornecedores;
CREATE POLICY "Users update own fornecedores"
ON public.fornecedores
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own fornecedores" ON public.fornecedores;
CREATE POLICY "Users delete own fornecedores"
ON public.fornecedores
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
