CREATE TABLE public.catalogo_mestre (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ean             text UNIQUE,
  nome            text NOT NULL,
  categoria       text,
  embalagem       text CHECK (embalagem IN ('UNI','CX','DZ','DP','FD','KG','PCT','LT')),
  fator_embalagem integer NOT NULL DEFAULT 1,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_catalogo_mestre_ean
  ON public.catalogo_mestre(ean);
CREATE INDEX idx_catalogo_mestre_categoria
  ON public.catalogo_mestre(categoria);
CREATE INDEX idx_catalogo_mestre_ativo
  ON public.catalogo_mestre(ativo);

-- Full-text search index for product names (Portuguese)
CREATE INDEX idx_catalogo_mestre_nome
  ON public.catalogo_mestre USING gin(to_tsvector('portuguese', nome));

-- RLS: read for all authenticated users, write only for admins
ALTER TABLE public.catalogo_mestre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active catalogo_mestre"
  ON public.catalogo_mestre FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admin can write catalogo_mestre"
  ON public.catalogo_mestre FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());