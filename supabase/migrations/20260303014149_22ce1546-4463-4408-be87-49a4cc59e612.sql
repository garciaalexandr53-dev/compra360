
-- Enum para status de cotação
CREATE TYPE public.cotacao_status AS ENUM ('ativa', 'finalizada', 'cancelada');
CREATE TYPE public.pedido_status AS ENUM ('rascunho', 'enviado', 'confirmado');

-- Categorias
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  embalagem TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fornecedores
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  representante TEXT,
  telefone TEXT,
  email TEXT,
  pedido_minimo NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cotações
CREATE TABLE public.cotacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  status public.cotacao_status NOT NULL DEFAULT 'ativa',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_at TIMESTAMPTZ
);

-- Produtos incluídos em cada cotação
CREATE TABLE public.cotacao_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC(12,3) DEFAULT 1,
  UNIQUE(cotacao_id, produto_id)
);

-- Preços dos fornecedores
CREATE TABLE public.precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_produto_id UUID NOT NULL REFERENCES public.cotacao_produtos(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  preco NUMERIC(12,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cotacao_produto_id, fornecedor_id)
);

-- Pedidos
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  status public.pedido_status NOT NULL DEFAULT 'rascunho',
  total NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria_id);
CREATE INDEX idx_cotacao_produtos_cotacao ON public.cotacao_produtos(cotacao_id);
CREATE INDEX idx_precos_cotacao_produto ON public.precos(cotacao_produto_id);
CREATE INDEX idx_precos_fornecedor ON public.precos(fornecedor_id);
CREATE INDEX idx_cotacoes_status ON public.cotacoes(status);
CREATE INDEX idx_fornecedores_token ON public.fornecedores(token);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_precos_updated_at BEFORE UPDATE ON public.precos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is authenticated buyer
CREATE OR REPLACE FUNCTION public.is_buyer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Helper: get supplier id from token (passed as request header or RPC param)
CREATE OR REPLACE FUNCTION public.get_supplier_id_from_token(_token TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.fornecedores WHERE token = _token LIMIT 1
$$;

-- RLS: Categorias (buyers full access)
CREATE POLICY "Buyers full access categorias" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Produtos (buyers full access)
CREATE POLICY "Buyers full access produtos" ON public.produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Fornecedores (buyers full access)
CREATE POLICY "Buyers full access fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Cotações (buyers full access)
CREATE POLICY "Buyers full access cotacoes" ON public.cotacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Cotação Produtos (buyers full access)
CREATE POLICY "Buyers full access cotacao_produtos" ON public.cotacao_produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Preços (buyers full access)
CREATE POLICY "Buyers full access precos" ON public.precos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Pedidos (buyers full access)
CREATE POLICY "Buyers full access pedidos" ON public.pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS: Anon access for suppliers (via token - will use edge function for writes)
-- Suppliers can read categorias, produtos, cotacoes, cotacao_produtos via anon
CREATE POLICY "Anon read categorias" ON public.categorias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read produtos" ON public.produtos FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read cotacoes ativas" ON public.cotacoes FOR SELECT TO anon USING (status = 'ativa');
CREATE POLICY "Anon read cotacao_produtos" ON public.cotacao_produtos FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.cotacoes WHERE id = cotacao_id AND status = 'ativa')
);

-- Enable realtime for precos table
ALTER PUBLICATION supabase_realtime ADD TABLE public.precos;
