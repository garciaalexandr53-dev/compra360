
CREATE TABLE public.cotacao_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cotacao_id, fornecedor_id)
);

ALTER TABLE public.cotacao_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers full access cotacao_fornecedores"
ON public.cotacao_fornecedores
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon read cotacao_fornecedores"
ON public.cotacao_fornecedores
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM cotacoes WHERE cotacoes.id = cotacao_fornecedores.cotacao_id AND cotacoes.status = 'ativa'::cotacao_status
));
