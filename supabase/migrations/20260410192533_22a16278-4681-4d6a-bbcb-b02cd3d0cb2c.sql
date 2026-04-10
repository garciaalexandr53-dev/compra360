
-- 1. Remove the overly broad anon read policy on produtos
DROP POLICY IF EXISTS "Anon read produtos by loja owner" ON public.produtos;

-- 2. Tighten anon read on itens_faltantes: only allow reading items the anon user just inserted (same session won't help, but we limit to non-imported recent items)
DROP POLICY IF EXISTS "Anon read itens_faltantes by loja" ON public.itens_faltantes;

CREATE POLICY "Anon read own recent itens_faltantes"
  ON public.itens_faltantes
  FOR SELECT
  TO anon
  USING (
    loja_id IS NOT NULL
    AND loja_exists(loja_id)
    AND importado = false
    AND created_at > (now() - interval '24 hours')
  );
