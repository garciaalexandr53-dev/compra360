
-- Add billing fields to lojas table
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS inscricao_estadual text;
