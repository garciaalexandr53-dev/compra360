
-- 1. Remove the vulnerable anon UPDATE policy on pedidos
DROP POLICY IF EXISTS "Anon update pedidos to recebido" ON public.pedidos;

-- 2. Tighten conferencia inserts: only allow for pedidos with status 'enviado'
DROP POLICY IF EXISTS "Anon insert conferencias" ON public.conferencias;
CREATE POLICY "Anon insert conferencias"
  ON public.conferencias
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = conferencias.pedido_id
      AND p.status = 'enviado'::pedido_status
    )
  );

DROP POLICY IF EXISTS "Anon insert conferencia_itens" ON public.conferencia_itens;
CREATE POLICY "Anon insert conferencia_itens"
  ON public.conferencia_itens
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conferencias conf
      JOIN pedidos p ON p.id = conf.pedido_id
      WHERE conf.id = conferencia_itens.conferencia_id
      AND p.status = 'enviado'::pedido_status
    )
  );
