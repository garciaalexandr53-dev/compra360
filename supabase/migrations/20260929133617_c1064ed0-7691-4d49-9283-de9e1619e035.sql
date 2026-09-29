CREATE TABLE public.leads_whitepaper (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30),
  empresa text check (empresa is null or char_length(empresa) <= 160),
  perfil text check (perfil is null or perfil in ('investidor','supermercado','fornecedor','outro')),
  created_at timestamptz not null default now()
);
GRANT INSERT ON public.leads_whitepaper TO anon, authenticated;
GRANT SELECT ON public.leads_whitepaper TO authenticated;
GRANT ALL ON public.leads_whitepaper TO service_role;
ALTER TABLE public.leads_whitepaper ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer pessoa registra interesse" ON public.leads_whitepaper FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins leem leads" ON public.leads_whitepaper FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));