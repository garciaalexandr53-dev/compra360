
-- Add prazo_pagamento (payment terms) to fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS prazo_pagamento text;

-- Create table for employee missing items (App Funcionários)
CREATE TABLE IF NOT EXISTS public.itens_faltantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  quantidade integer DEFAULT 1,
  observacao text,
  registrado_por text,
  importado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itens_faltantes ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (employees don't need login)
CREATE POLICY "Anyone can insert itens_faltantes" ON public.itens_faltantes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anyone can read
CREATE POLICY "Anyone can read itens_faltantes" ON public.itens_faltantes
  FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated users can update/delete
CREATE POLICY "Buyers manage itens_faltantes" ON public.itens_faltantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
