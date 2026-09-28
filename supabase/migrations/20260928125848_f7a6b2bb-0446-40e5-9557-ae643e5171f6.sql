DROP FUNCTION IF EXISTS public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text, jsonb);

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
  _cidades jsonb DEFAULT NULL,
  _cnpj text DEFAULT NULL,
  _razao_social text DEFAULT NULL
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
  _cnpj_digits text;
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

  _cnpj_digits := NULLIF(regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g'), '');
  IF _cnpj_digits IS NOT NULL AND length(_cnpj_digits) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
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
    cnpj = _cnpj_digits,
    razao_social = COALESCE(NULLIF(btrim(COALESCE(_razao_social, '')), ''), razao_social),
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
        CASE WHEN COALESCE(_cnpj_digits, '') <> COALESCE(_antes.cnpj, '')
             THEN ' | cnpj: ' || COALESCE(_antes.cnpj, '—') || ' → ' || COALESCE(_cnpj_digits, '—')
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

REVOKE EXECUTE ON FUNCTION public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text, jsonb, text, text) TO authenticated, service_role;

-- Portal do fornecedor: devolve o CNPJ salvo para revalidação silenciosa na Receita.
DROP FUNCTION IF EXISTS public.get_supplier_onboarding_state(text, uuid);

CREATE OR REPLACE FUNCTION public.get_supplier_onboarding_state(_token text, _cotacao_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(pedir_cnpj boolean, pedir_pasta boolean, pedir_consentimento boolean, permite_skip boolean, pasta text[], tipo_fornecedor text, pedir_cidades boolean, participa_rede boolean, cidades jsonb, cidade_loja text, uf_loja text, cnpj_atual text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  WITH alvo AS (
    SELECT f.* FROM public.fornecedores f WHERE f.token = _token LIMIT 1
  ),
  grupo AS (
    SELECT f.*
    FROM public.fornecedores f
    WHERE f.id IN (SELECT g.id FROM public.fornecedor_grupo_ids((SELECT id FROM alvo)) g)
  ),
  agg AS (
    SELECT
      bool_or(g.consentimento_rede = 'sim') AS tem_sim,
      max(public.fornecedor_cnpj_key(g.cnpj)) AS cnpj_key,
      max(g.consentimento_recusas) AS recusas,
      max(g.consentimento_ultima_pergunta) AS ultima_pergunta,
      (SELECT g2.pasta FROM grupo g2
         ORDER BY COALESCE(array_length(g2.pasta,1),0) DESC, g2.created_at LIMIT 1) AS pasta_grupo,
      (SELECT g3.tipo_fornecedor FROM grupo g3
         ORDER BY (g3.tipo_fornecedor IS NULL), g3.created_at LIMIT 1) AS tipo_grupo,
      COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object('cidade', c.cidade, 'uf', c.uf))
        FROM public.fornecedor_cidades_atendidas c
        WHERE c.fornecedor_id IN (SELECT gg.id FROM grupo gg)
      ), '[]'::jsonb) AS cidades_grupo
    FROM grupo g
  )
  SELECT
    (ag.cnpj_key IS NULL) AS pedir_cnpj,
    (COALESCE(array_length(ag.pasta_grupo, 1), 0) = 0) AS pedir_pasta,
    CASE
      WHEN ag.tem_sim THEN false
      WHEN a.consentimento_rede = 'pendente' AND COALESCE(ag.recusas,0) = 0 THEN true
      WHEN COALESCE(ag.recusas,0) >= 2 THEN false
      ELSE (ag.ultima_pergunta IS NULL OR ag.ultima_pergunta <= now() - interval '90 days')
    END AS pedir_consentimento,
    (a.consentimento_tentativas_skip < 3) AS permite_skip,
    ag.pasta_grupo AS pasta,
    ag.tipo_grupo AS tipo_fornecedor,
    (ag.tem_sim AND jsonb_array_length(ag.cidades_grupo) = 0) AS pedir_cidades,
    ag.tem_sim AS participa_rede,
    ag.cidades_grupo AS cidades,
    (SELECT l.cidade FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = a.id
      WHERE co.id = _cotacao_id LIMIT 1) AS cidade_loja,
    (SELECT l.uf FROM public.cotacoes co
       JOIN public.lojas l ON l.id = co.loja_id
       JOIN public.cotacao_fornecedores cf ON cf.cotacao_id = co.id AND cf.fornecedor_id = a.id
      WHERE co.id = _cotacao_id LIMIT 1) AS uf_loja,
    ag.cnpj_key AS cnpj_atual
  FROM alvo a CROSS JOIN agg ag
$function$;

REVOKE EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supplier_onboarding_state(text, uuid) TO anon, authenticated, service_role;