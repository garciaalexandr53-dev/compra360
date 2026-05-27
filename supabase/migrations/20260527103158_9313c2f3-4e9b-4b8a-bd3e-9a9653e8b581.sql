
-- 1. precos: drop anon read, add RPC for supplier to read its own prices
DROP POLICY IF EXISTS "Anon read precos ativas" ON public.precos;

CREATE OR REPLACE FUNCTION public.get_supplier_existing_prices(_token text, _cp_ids uuid[])
RETURNS TABLE(cotacao_produto_id uuid, preco numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supplier_id uuid;
BEGIN
  SELECT id INTO _supplier_id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _supplier_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.cotacao_produto_id, p.preco
    FROM public.precos p
    WHERE p.fornecedor_id = _supplier_id
      AND p.cotacao_produto_id = ANY(_cp_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_existing_prices(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_existing_prices(text, uuid[]) TO anon, authenticated;

-- 2. itens_faltantes: drop anon read
DROP POLICY IF EXISTS "Anon read own recent itens_faltantes" ON public.itens_faltantes;

-- 3. cotacoes: drop anon read (supplier flow uses SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Anon read cotacoes ativas" ON public.cotacoes;

-- 4. cotacao_fornecedores: drop anon read
DROP POLICY IF EXISTS "Anon read cotacao_fornecedores" ON public.cotacao_fornecedores;

-- 5. conferencias / conferencia_itens: drop anon access (handled via edge function)
DROP POLICY IF EXISTS "Anon insert conferencias" ON public.conferencias;
DROP POLICY IF EXISTS "Anon read conferencias scoped" ON public.conferencias;
DROP POLICY IF EXISTS "Anon insert conferencia_itens" ON public.conferencia_itens;
DROP POLICY IF EXISTS "Anon read conferencia_itens scoped" ON public.conferencia_itens;

-- 6. Storage: restrict write access to admins on email-assets and logoatualizada
DROP POLICY IF EXISTS "Admins can upload to logoatualizada" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update logoatualizada" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete logoatualizada" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload to email-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update email-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete email-assets" ON storage.objects;

CREATE POLICY "Admins can upload to logoatualizada"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logoatualizada' AND public.is_admin());

CREATE POLICY "Admins can update logoatualizada"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logoatualizada' AND public.is_admin())
WITH CHECK (bucket_id = 'logoatualizada' AND public.is_admin());

CREATE POLICY "Admins can delete logoatualizada"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logoatualizada' AND public.is_admin());

CREATE POLICY "Admins can upload to email-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-assets' AND public.is_admin());

CREATE POLICY "Admins can update email-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'email-assets' AND public.is_admin())
WITH CHECK (bucket_id = 'email-assets' AND public.is_admin());

CREATE POLICY "Admins can delete email-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-assets' AND public.is_admin());
