ALTER TABLE public.itens_faltantes
  ADD COLUMN IF NOT EXISTS embalagem TEXT,
  ADD COLUMN IF NOT EXISTS fator_embalagem INTEGER;