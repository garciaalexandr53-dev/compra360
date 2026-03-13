
-- Add sequential order number to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero SERIAL;
