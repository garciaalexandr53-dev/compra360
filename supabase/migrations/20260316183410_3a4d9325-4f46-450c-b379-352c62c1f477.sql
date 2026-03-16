
-- Add loja_id to itens_faltantes so employee submissions are tied to a specific store
ALTER TABLE public.itens_faltantes ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL;
