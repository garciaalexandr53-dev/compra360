CREATE TABLE public.formatos_planilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  escopo text NOT NULL,
  assinatura text NOT NULL,
  mapeamento jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, escopo, assinatura)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formatos_planilha TO authenticated;
GRANT ALL ON public.formatos_planilha TO service_role;
ALTER TABLE public.formatos_planilha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono da loja gerencia formatos" ON public.formatos_planilha FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = loja_id AND l.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = loja_id AND l.user_id = auth.uid()));
CREATE TRIGGER update_formatos_planilha_updated_at BEFORE UPDATE ON public.formatos_planilha
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();