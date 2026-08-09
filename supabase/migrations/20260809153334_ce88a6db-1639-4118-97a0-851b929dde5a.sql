DROP POLICY IF EXISTS "Auth read itens_faltantes" ON public.itens_faltantes;

DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
CREATE POLICY "Public read email-assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "Public read logoatualizada" ON storage.objects;
CREATE POLICY "Public read logoatualizada"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logoatualizada');