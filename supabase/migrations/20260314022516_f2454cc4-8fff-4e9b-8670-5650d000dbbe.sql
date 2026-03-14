
-- Conferencias table
CREATE TABLE public.conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  conferido_por text NOT NULL DEFAULT 'Funcionário',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Conferencia items
CREATE TABLE public.conferencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conferencia_id uuid NOT NULL REFERENCES public.conferencias(id) ON DELETE CASCADE,
  produto_nome text NOT NULL,
  embalagem text,
  quantidade_pedida numeric NOT NULL DEFAULT 0,
  quantidade_recebida numeric NOT NULL DEFAULT 0,
  preco_cotado numeric,
  preco_nf numeric,
  divergencia_qtd boolean NOT NULL DEFAULT false,
  divergencia_preco boolean NOT NULL DEFAULT false
);

ALTER TABLE public.conferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferencia_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon insert conferencias" ON public.conferencias FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read conferencias" ON public.conferencias FOR SELECT TO anon USING (true);
CREATE POLICY "Buyers full access conferencias" ON public.conferencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon insert conferencia_itens" ON public.conferencia_itens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read conferencia_itens" ON public.conferencia_itens FOR SELECT TO anon USING (true);
CREATE POLICY "Buyers full access conferencia_itens" ON public.conferencia_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon read pedidos enviados
CREATE POLICY "Anon read pedidos enviados" ON public.pedidos FOR SELECT TO anon USING (status = 'enviado'::pedido_status);

-- Anon update pedidos to recebido
CREATE POLICY "Anon update pedidos to recebido" ON public.pedidos FOR UPDATE TO anon USING (status = 'enviado'::pedido_status) WITH CHECK (status = 'recebido'::pedido_status);
