
-- Create lojas table
CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  endereco text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers full access lojas" ON public.lojas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read lojas" ON public.lojas FOR SELECT TO anon USING (true);

-- Junction table: which suppliers serve which stores
CREATE TABLE public.fornecedor_lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, loja_id)
);

ALTER TABLE public.fornecedor_lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers full access fornecedor_lojas" ON public.fornecedor_lojas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read fornecedor_lojas" ON public.fornecedor_lojas FOR SELECT TO anon USING (true);

-- Add loja_id to cotacoes
ALTER TABLE public.cotacoes ADD COLUMN loja_id uuid REFERENCES public.lojas(id);

-- Add loja_id to pedidos  
ALTER TABLE public.pedidos ADD COLUMN loja_id uuid REFERENCES public.lojas(id);
