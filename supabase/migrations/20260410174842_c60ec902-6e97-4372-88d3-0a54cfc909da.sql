
ALTER TABLE public.produtos ADD COLUMN fator_embalagem integer NOT NULL DEFAULT 1;
ALTER TABLE public.cotacao_produtos ADD COLUMN fator_embalagem integer NOT NULL DEFAULT 1;
