ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS consentimento_rede text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS consentimento_ultima_pergunta timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_tentativas_skip int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consentimento_recusas int NOT NULL DEFAULT 0;

ALTER TABLE public.fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_consentimento_rede_check;
ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_consentimento_rede_check
  CHECK (consentimento_rede IN ('pendente','sim','nao'));

CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj_digits
  ON public.fornecedores (regexp_replace(COALESCE(cnpj,''), '\D', '', 'g'))
  WHERE cnpj IS NOT NULL;

-- ============ Estado do onboarding no portal do fornecedor ============
CREATE OR REPLACE FUNCTION public.get_supplier_onboarding_state(_token text)
RETURNS TABLE(
  pedir_cnpj boolean,
  pedir_pasta boolean,
  pedir_consentimento boolean,
  permite_skip boolean,
  pasta text[],
  tipo_fornecedor text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (f.cnpj IS NULL OR btrim(f.cnpj) = '') AS pedir_cnpj,
    (COALESCE(array_length(f.pasta, 1), 0) = 0) AS pedir_pasta,
    CASE
      WHEN f.consentimento_rede = 'sim' THEN false
      WHEN f.consentimento_rede = 'pendente' THEN true
      WHEN f.consentimento_rede = 'nao' AND f.consentimento_recusas <= 1 THEN
        (f.consentimento_ultima_pergunta IS NULL
         OR f.consentimento_ultima_pergunta <= now() - interval '90 days')
      WHEN f.consentimento_rede = 'nao' AND f.consentimento_recusas >= 2 THEN false
      ELSE false
    END AS pedir_consentimento,
    (f.consentimento_tentativas_skip < 3) AS permite_skip,
    f.pasta,
    f.tipo_fornecedor
  FROM public.fornecedores f
  WHERE f.token = _token
  LIMIT 1
$$;

-- ============ CNPJ já usado por outro cadastro? ============
CREATE OR REPLACE FUNCTION public.checar_cnpj_duplicado(_token text, _cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fornecedores o
    WHERE o.id <> COALESCE((SELECT f.id FROM public.fornecedores f WHERE f.token = _token LIMIT 1),
                           '00000000-0000-0000-0000-000000000000'::uuid)
      AND o.cnpj IS NOT NULL
      AND regexp_replace(o.cnpj, '\D', '', 'g') = regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g')
      AND length(regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g')) = 14
  )
$$;

-- ============ Gravação das respostas ============
CREATE OR REPLACE FUNCTION public.salvar_dados_fornecedor(
  _token text,
  _cnpj text DEFAULT NULL,
  _pasta text[] DEFAULT NULL,
  _consentimento text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN
    RETURN false;
  END IF;

  IF _consentimento IS NOT NULL AND _consentimento NOT IN ('sim','nao') THEN
    RAISE EXCEPTION 'Consentimento inválido';
  END IF;

  IF length(_cnpj_digits) = 14 THEN
    UPDATE public.fornecedores
      SET cnpj = _cnpj_digits,
          consentimento_tentativas_skip = 0,
          updated_at = now()
    WHERE id = _id;
  END IF;

  IF _pasta IS NOT NULL AND array_length(_pasta, 1) > 0 THEN
    UPDATE public.fornecedores
      SET pasta = _pasta,
          updated_at = now()
    WHERE id = _id;
  END IF;

  IF _consentimento IS NOT NULL THEN
    UPDATE public.fornecedores
      SET consentimento_rede = _consentimento,
          consentimento_ultima_pergunta = now(),
          consentimento_recusas = CASE
            WHEN _consentimento = 'nao' THEN consentimento_recusas + 1
            ELSE consentimento_recusas
          END,
          updated_at = now()
    WHERE id = _id;
  END IF;

  RETURN true;
END;
$$;

-- ============ Contador de "Responder depois" ============
CREATE OR REPLACE FUNCTION public.registrar_skip_cnpj(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id
  FROM public.fornecedores
  WHERE token = _token AND (cnpj IS NULL OR btrim(cnpj) = '')
  LIMIT 1;

  IF _id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.fornecedores
    SET consentimento_tentativas_skip = consentimento_tentativas_skip + 1,
        updated_at = now()
  WHERE id = _id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.checar_cnpj_duplicado(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_skip_cnpj(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checar_cnpj_duplicado(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_skip_cnpj(text) TO anon, authenticated, service_role;

-- ============ Sugestões da região: só quem consentiu ============
CREATE OR REPLACE FUNCTION public.sugerir_fornecedores_por_cidade(_loja_id uuid)
RETURNS TABLE(id uuid, nome text, representante text, telefone text, tipo_fornecedor text, pasta text[], pedido_minimo numeric, prazo_pagamento text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cidade_norm text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT btrim(regexp_replace(
           lower(translate(COALESCE(l.cidade, ''),
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
             'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
           '\s+', ' ', 'g'))
    INTO _cidade_norm
  FROM public.lojas l
  WHERE l.id = _loja_id AND l.user_id = _uid;

  IF _cidade_norm IS NULL OR _cidade_norm = '' THEN RETURN; END IF;

  RETURN QUERY
  WITH meus AS (
    SELECT DISTINCT CASE
             WHEN length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 12
               AND left(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 2) = '55'
               THEN right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'),
                          length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) - 2)
             ELSE regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')
           END AS fone_digits
    FROM public.fornecedores f
    WHERE f.user_id = _uid
  ),
  cand AS (
    SELECT DISTINCT
      f.id, f.nome, f.representante, f.telefone, f.tipo_fornecedor, f.pasta,
      f.pedido_minimo, f.prazo_pagamento, f.created_at,
      CASE
        WHEN length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 12
          AND left(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 2) = '55'
          THEN right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'),
                     length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) - 2)
        ELSE regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')
      END AS fone_digits,
      btrim(regexp_replace(regexp_replace(
        lower(translate(f.nome,
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS nome_norm,
      btrim(regexp_replace(regexp_replace(
        lower(translate(COALESCE(f.representante, ''),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS rep_norm
    FROM public.fornecedores f
    JOIN public.fornecedor_lojas fl ON fl.fornecedor_id = f.id
    JOIN public.lojas l ON l.id = fl.loja_id
    WHERE fl.loja_id <> _loja_id
      AND (f.user_id IS NULL OR f.user_id <> _uid)
      AND f.consentimento_rede = 'sim'
      AND btrim(regexp_replace(
            lower(translate(COALESCE(l.cidade, ''),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
              'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
            '\s+', ' ', 'g')) = _cidade_norm
  ),
  sem_meus AS (
    SELECT c.* FROM cand c
    WHERE length(c.fone_digits) < 10
       OR NOT EXISTS (SELECT 1 FROM meus m WHERE m.fone_digits = c.fone_digits)
  ),
  dedup AS (
    SELECT DISTINCT ON (
      CASE WHEN length(s.fone_digits) >= 10 THEN s.fone_digits
           ELSE s.nome_norm || '|' || s.rep_norm END
    ) s.*
    FROM sem_meus s
    ORDER BY
      CASE WHEN length(s.fone_digits) >= 10 THEN s.fone_digits
           ELSE s.nome_norm || '|' || s.rep_norm END,
      s.created_at DESC
  )
  SELECT d.id, d.nome, d.representante, d.telefone, d.tipo_fornecedor, d.pasta,
         d.pedido_minimo, d.prazo_pagamento
  FROM dedup d
  ORDER BY d.nome_norm ASC;
END;
$function$;