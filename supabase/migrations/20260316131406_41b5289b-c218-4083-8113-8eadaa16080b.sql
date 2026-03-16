
-- Assign existing cotações with null loja_id to the first loja (by created_at)
UPDATE public.cotacoes 
SET loja_id = (SELECT id FROM public.lojas ORDER BY created_at ASC LIMIT 1)
WHERE loja_id IS NULL;

-- Assign existing pedidos with null loja_id to the first loja
UPDATE public.pedidos 
SET loja_id = (SELECT id FROM public.lojas ORDER BY created_at ASC LIMIT 1)
WHERE loja_id IS NULL;
