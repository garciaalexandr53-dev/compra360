
CREATE TABLE public.catalogo_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'Geral',
  embalagem text NOT NULL DEFAULT 'un',
  fator_embalagem integer NOT NULL DEFAULT 1,
  segmento text NOT NULL DEFAULT 'supermercado',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read catalogo_base"
  ON public.catalogo_base FOR SELECT
  TO public
  USING (true);

CREATE INDEX idx_catalogo_base_segmento ON public.catalogo_base (segmento);
CREATE INDEX idx_catalogo_base_categoria ON public.catalogo_base (categoria);
