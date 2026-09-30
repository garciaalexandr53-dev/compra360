DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('copiar_fornecedores_para_loja','desvincular_parceiro_empresa')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
  END LOOP;
END $$;
ALTER TABLE public.fornecedores ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(16), 'hex');