-- Consulta publica leve: informa apenas se o WhatsApp ja existe na Rede
CREATE OR REPLACE FUNCTION public.whatsapp_parceiro_existe(_telefone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _nome text;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN
    _fone := substr(_fone, 3);
  END IF;
  IF length(_fone) NOT IN (10, 11) THEN
    RETURN jsonb_build_object('existe', false);
  END IF;

  SELECT f.nome INTO _nome
  FROM public.fornecedores f
  WHERE right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 10) = right(_fone, 10)
    AND length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 10
  ORDER BY f.created_at DESC
  LIMIT 1;

  IF _nome IS NULL THEN
    RETURN jsonb_build_object('existe', false);
  END IF;

  RETURN jsonb_build_object('existe', true, 'nome', _nome);
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_parceiro_existe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_parceiro_existe(text) TO anon, authenticated, service_role;

-- Cadastro publico do parceiro: agora bloqueia numero ja cadastrado
CREATE OR REPLACE FUNCTION public.cadastrar_fornecedor_parceiro(_nome text, _representante text, _telefone text, _cnpj text DEFAULT NULL::text, _tipo text DEFAULT NULL::text, _pastas text[] DEFAULT NULL::text[], _cidades jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _fone_key text;
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _nome_clean text := btrim(COALESCE(_nome,''));
  _rep_clean text := btrim(COALESCE(_representante,''));
  _id uuid;
  _codigo text;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN
    _fone := substr(_fone, 3);
  END IF;

  IF _nome_clean = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;
  IF length(_fone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF length(_fone) = 11 AND substr(_fone, 3, 1) <> '9' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF substr(_fone, 1, 2)::int < 11 OR substr(_fone, 1, 2)::int > 99 THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF _fone ~ '^(\d)\1+$' THEN
    RAISE EXCEPTION 'WhatsApp inválido';
  END IF;
  IF _cnpj_digits <> '' AND length(_cnpj_digits) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  _fone_key := right(_fone, 10);

  SELECT f.id INTO _id
  FROM public.fornecedores f
  WHERE right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 10) = _fone_key
    AND length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 10
  ORDER BY f.created_at DESC
  LIMIT 1;

  -- Numero ja existe: nao sobrescreve nada, orienta usar a area do parceiro
  IF _id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ja_cadastrado');
  END IF;

  INSERT INTO public.fornecedores (
    nome, representante, telefone, cnpj, tipo_fornecedor, pasta,
    token, consentimento_rede, consentimento_ultima_pergunta, origem_cadastro
  ) VALUES (
    upper(_nome_clean),
    NULLIF(_rep_clean, ''),
    _fone,
    NULLIF(_cnpj_digits, ''),
    NULLIF(btrim(COALESCE(_tipo,'')), ''),
    _pastas,
    replace(gen_random_uuid()::text, '-', ''),
    'sim',
    now(),
    'autocadastro'
  )
  RETURNING id INTO _id;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id,
           btrim(x->>'cidade'),
           NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''),
           public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x
    WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  _codigo := public.gerar_codigo_acesso_parceiro(_id, _fone, 'cadastro');

  RETURN jsonb_build_object('status', 'criado', 'codigo', _codigo);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cadastrar_fornecedor_parceiro(text, text, text, text, text, text[], jsonb) TO anon, authenticated, service_role;