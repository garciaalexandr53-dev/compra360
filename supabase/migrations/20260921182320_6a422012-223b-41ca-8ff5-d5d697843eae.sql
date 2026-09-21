-- ============ Helper de normalização de cidade ============
CREATE OR REPLACE FUNCTION public.norm_cidade(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT btrim(regexp_replace(
    lower(translate(COALESCE(_v, ''),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
      'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    '\s+', ' ', 'g'))
$$;

-- ============ Cidades atendidas ============
CREATE TABLE IF NOT EXISTS public.fornecedor_cidades_atendidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  cidade text NOT NULL,
  uf text,
  cidade_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedor_cidades_unica
  ON public.fornecedor_cidades_atendidas (fornecedor_id, cidade_norm, COALESCE(uf, ''));
CREATE INDEX IF NOT EXISTS fornecedor_cidades_norm_idx
  ON public.fornecedor_cidades_atendidas (cidade_norm);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedor_cidades_atendidas TO authenticated;
GRANT ALL ON public.fornecedor_cidades_atendidas TO service_role;

ALTER TABLE public.fornecedor_cidades_atendidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cidades_owner_all" ON public.fornecedor_cidades_atendidas;
CREATE POLICY "cidades_owner_all"
ON public.fornecedor_cidades_atendidas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.user_id = auth.uid()));

DROP POLICY IF EXISTS "cidades_admin_all" ON public.fornecedor_cidades_atendidas;
CREATE POLICY "cidades_admin_all"
ON public.fornecedor_cidades_atendidas FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ Estado do onboarding do fornecedor ============
DROP FUNCTION IF EXISTS public.get_supplier_onboarding_state(text);

CREATE OR REPLACE FUNCTION public.get_supplier_onboarding_state(_token text, _cotacao_id uuid DEFAULT NULL)
RETURNS TABLE(
  pedir_cnpj boolean,
  pedir_pasta boolean,
  pedir_consentimento boolean,
  permite_skip boolean,
  pasta text[],
  tipo_fornecedor text,
  pedir_cidades boolean,
  participa_rede boolean,
  cidades jsonb,
  cidade_loja text,
  uf_loja text
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
    f.tipo_fornecedor,
    (f.consentimento_rede = 'sim'
     AND NOT EXISTS (SELECT 1 FROM public.fornecedor_cidades_atendidas c WHERE c.fornecedor_id = f.id)
    ) AS pedir_cidades,
    (f.consentimento_rede = 'sim') AS participa_rede,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', c.uf) ORDER BY c.cidade)
      FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = f.id
    ), '[]'::jsonb) AS cidades,
    (SELECT l.cidade FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = f.id
      WHERE co.id = _cotacao_id LIMIT 1) AS cidade_loja,
    (SELECT l.uf FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = f.id
      WHERE co.id = _cotacao_id LIMIT 1) AS uf_loja
  FROM public.fornecedores f
  WHERE f.token = _token
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text, uuid) TO anon, authenticated, service_role;

-- ============ Gravação das respostas (com cidades) ============
DROP FUNCTION IF EXISTS public.salvar_dados_fornecedor(text, text, text[], text);

CREATE OR REPLACE FUNCTION public.salvar_dados_fornecedor(
  _token text,
  _cnpj text DEFAULT NULL,
  _pasta text[] DEFAULT NULL,
  _consentimento text DEFAULT NULL,
  _cidades jsonb DEFAULT NULL
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

  -- Sincroniza as cidades atendidas quando a lista é enviada.
  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    WITH novas AS (
      SELECT DISTINCT
        btrim(x->>'cidade') AS cidade,
        NULLIF(upper(btrim(COALESCE(x->>'uf',''))), '') AS uf,
        public.norm_cidade(x->>'cidade') AS cidade_norm
      FROM jsonb_array_elements(_cidades) x
      WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    )
    , removidas AS (
      DELETE FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = _id
        AND NOT EXISTS (
          SELECT 1 FROM novas n
          WHERE n.cidade_norm = c.cidade_norm
            AND COALESCE(n.uf,'') = COALESCE(c.uf,'')
        )
      RETURNING 1
    )
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT _id, n.cidade, n.uf, n.cidade_norm
    FROM novas n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = _id
        AND c.cidade_norm = n.cidade_norm
        AND COALESCE(c.uf,'') = COALESCE(n.uf,'')
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_dados_fornecedor(text, text, text[], text, jsonb) TO anon, authenticated, service_role;

-- ============ Sugestões da região: cidades declaradas + cidades já atendidas ============
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

  SELECT public.norm_cidade(l.cidade) INTO _cidade_norm
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
  base AS (
    SELECT f.*
    FROM public.fornecedores f
    WHERE (f.user_id IS NULL OR f.user_id <> _uid)
      AND f.consentimento_rede = 'sim'
      AND NOT EXISTS (
        SELECT 1 FROM public.fornecedor_lojas fl2
        WHERE fl2.fornecedor_id = f.id AND fl2.loja_id = _loja_id
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.fornecedor_cidades_atendidas c
          WHERE c.fornecedor_id = f.id AND c.cidade_norm = _cidade_norm
        )
        OR EXISTS (
          SELECT 1
          FROM public.fornecedor_lojas fl
          JOIN public.lojas l ON l.id = fl.loja_id
          WHERE fl.fornecedor_id = f.id
            AND fl.loja_id <> _loja_id
            AND public.norm_cidade(l.cidade) = _cidade_norm
        )
      )
  ),
  cand AS (
    SELECT
      b.id, b.nome, b.representante, b.telefone, b.tipo_fornecedor, b.pasta,
      b.pedido_minimo, b.prazo_pagamento, b.created_at,
      CASE
        WHEN length(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g')) >= 12
          AND left(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g'), 2) = '55'
          THEN right(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g'),
                     length(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g')) - 2)
        ELSE regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g')
      END AS fone_digits,
      public.norm_cidade(b.nome) AS nome_norm,
      public.norm_cidade(COALESCE(b.representante, '')) AS rep_norm
    FROM base b
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

REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) TO authenticated, service_role;

-- ============ Admin: ficha do fornecedor com cidades ============
CREATE OR REPLACE FUNCTION public.admin_get_fornecedor_detalhes(_fornecedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'representante', f.representante,
    'telefone', f.telefone,
    'email', f.email,
    'pedido_minimo', f.pedido_minimo,
    'prazo_pagamento', f.prazo_pagamento,
    'observacoes', f.observacoes,
    'tipo_fornecedor', f.tipo_fornecedor,
    'pasta', COALESCE(to_jsonb(f.pasta), '[]'::jsonb),
    'cnpj', f.cnpj,
    'consentimento_rede', f.consentimento_rede,
    'consentimento_ultima_pergunta', f.consentimento_ultima_pergunta,
    'consentimento_tentativas_skip', f.consentimento_tentativas_skip,
    'consentimento_recusas', f.consentimento_recusas,
    'cidades_atendidas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', c.uf) ORDER BY c.cidade)
      FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = f.id
    ), '[]'::jsonb),
    'created_at', f.created_at,
    'user_id', f.user_id,
    'cliente_nome', (SELECT pr.nome FROM public.profiles pr
                       WHERE pr.user_id = f.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
                       LIMIT 1),
    'cliente_email', (SELECT u.email::text FROM auth.users u WHERE u.id = f.user_id),
    'cliente_empresa', (SELECT l.nome FROM public.lojas l WHERE l.user_id = f.user_id
                          ORDER BY l.created_at ASC LIMIT 1),
    'lojas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cidade', l.cidade, 'uf', l.uf)
                       ORDER BY l.nome)
      FROM public.fornecedor_lojas fl
      JOIN public.lojas l ON l.id = fl.loja_id
      WHERE fl.fornecedor_id = f.id
    ), '[]'::jsonb),
    'cotacoes_recebidas', (SELECT COUNT(*) FROM public.cotacao_fornecedores cf WHERE cf.fornecedor_id = f.id),
    'cotacoes_respondidas', (
      SELECT COUNT(DISTINCT cp.cotacao_id)
      FROM public.precos p
      JOIN public.cotacao_produtos cp ON cp.id = p.cotacao_produto_id
      WHERE p.fornecedor_id = f.id
    ),
    'ultima_resposta_at', (
      SELECT MAX(p.updated_at) FROM public.precos p WHERE p.fornecedor_id = f.id
    )
  ) INTO result
  FROM public.fornecedores f
  WHERE f.id = _fornecedor_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text);

CREATE OR REPLACE FUNCTION public.admin_update_fornecedor(
  _fornecedor_id uuid,
  _nome text,
  _representante text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _pedido_minimo numeric DEFAULT NULL,
  _prazo_pagamento text DEFAULT NULL,
  _observacoes text DEFAULT NULL,
  _tipo_fornecedor text DEFAULT NULL,
  _pasta text[] DEFAULT NULL,
  _consentimento_rede text DEFAULT NULL,
  _cidades jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _antes public.fornecedores;
  _tipo text;
  _pastas text[];
  _cons text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RAISE EXCEPTION 'Nome do fornecedor é obrigatório';
  END IF;

  _tipo := NULLIF(btrim(COALESCE(_tipo_fornecedor, '')), '');
  IF _tipo IS NOT NULL AND _tipo NOT IN ('geral', 'bebidas', 'especializado') THEN
    RAISE EXCEPTION 'Tipo de fornecedor inválido';
  END IF;

  _cons := NULLIF(btrim(lower(COALESCE(_consentimento_rede, ''))), '');
  IF _cons IS NOT NULL AND _cons NOT IN ('pendente', 'sim', 'nao') THEN
    RAISE EXCEPTION 'Consentimento inválido';
  END IF;

  IF _tipo = 'especializado' THEN
    _pastas := NULLIF(COALESCE(_pasta, ARRAY[]::text[]), ARRAY[]::text[]);
  ELSE
    _pastas := NULL;
  END IF;

  SELECT * INTO _antes FROM public.fornecedores WHERE id = _fornecedor_id;
  IF _antes.id IS NULL THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;
  _owner := _antes.user_id;

  UPDATE public.fornecedores SET
    nome = btrim(_nome),
    representante = NULLIF(btrim(COALESCE(_representante, '')), ''),
    telefone = NULLIF(btrim(COALESCE(_telefone, '')), ''),
    email = NULLIF(btrim(COALESCE(_email, '')), ''),
    pedido_minimo = _pedido_minimo,
    prazo_pagamento = NULLIF(btrim(COALESCE(_prazo_pagamento, '')), ''),
    observacoes = NULLIF(btrim(COALESCE(_observacoes, '')), ''),
    tipo_fornecedor = _tipo,
    pasta = _pastas,
    consentimento_rede = COALESCE(_cons, consentimento_rede),
    updated_at = now()
  WHERE id = _fornecedor_id;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    WITH novas AS (
      SELECT DISTINCT
        btrim(x->>'cidade') AS cidade,
        NULLIF(upper(btrim(COALESCE(x->>'uf',''))), '') AS uf,
        public.norm_cidade(x->>'cidade') AS cidade_norm
      FROM jsonb_array_elements(_cidades) x
      WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    )
    , removidas AS (
      DELETE FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = _fornecedor_id
        AND NOT EXISTS (
          SELECT 1 FROM novas n
          WHERE n.cidade_norm = c.cidade_norm
            AND COALESCE(n.uf,'') = COALESCE(c.uf,'')
        )
      RETURNING 1
    )
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT _fornecedor_id, n.cidade, n.uf, n.cidade_norm
    FROM novas n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = _fornecedor_id
        AND c.cidade_norm = n.cidade_norm
        AND COALESCE(c.uf,'') = COALESCE(n.uf,'')
    );
  END IF;

  IF _owner IS NOT NULL THEN
    INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
    VALUES (
      _owner, 'email', 'manual',
      'Fornecedor atualizado pelo suporte: ' || _antes.nome ||
        CASE WHEN btrim(_nome) <> _antes.nome THEN ' → ' || btrim(_nome) ELSE '' END ||
        CASE WHEN COALESCE(_telefone, '') <> COALESCE(_antes.telefone, '')
             THEN ' | telefone: ' || COALESCE(_antes.telefone, '—') || ' → ' || COALESCE(NULLIF(btrim(COALESCE(_telefone,'')),''), '—')
             ELSE '' END ||
        CASE WHEN COALESCE(_representante, '') <> COALESCE(_antes.representante, '')
             THEN ' | representante: ' || COALESCE(_antes.representante, '—') || ' → ' || COALESCE(NULLIF(btrim(COALESCE(_representante,'')),''), '—')
             ELSE '' END ||
        CASE WHEN COALESCE(_tipo, '') <> COALESCE(_antes.tipo_fornecedor, '')
             THEN ' | tipo: ' || COALESCE(_antes.tipo_fornecedor, '—') || ' → ' || COALESCE(_tipo, '—')
             ELSE '' END ||
        CASE WHEN _cons IS NOT NULL AND _cons <> COALESCE(_antes.consentimento_rede, '')
             THEN ' | consentimento: ' || COALESCE(_antes.consentimento_rede, '—') || ' → ' || _cons
             ELSE '' END,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
