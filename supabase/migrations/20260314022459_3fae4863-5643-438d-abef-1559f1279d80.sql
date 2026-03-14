
-- Add 'recebido' to pedido_status enum
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'recebido';
