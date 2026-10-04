DROP FUNCTION IF EXISTS public.cadastrar_fornecedor_parceiro(text, text, text, text, text, text[], jsonb, uuid);
CREATE FUNCTION public.cadastrar_fornecedor_parceiro(_nome text, _representante text, _telefone text, _cnpj text DEFAULT NULL, _tipo text DEFAULT NULL, _pastas text[] DEFAULT NULL, _cidades jsonb DEFAULT NULL, _convite_loja uuid DEFAULT NULL, _pedido_minimo numeric DEFAULT NULL, _prazo_pagamento text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _fone text := regexp_replace(COALESCE(_telefone,''), '\D', '', 'g');
  _fone_key text;
  _cnpj_digits text := regexp_replace(COALESCE(_cnpj,''), '\D', '', 'g');
  _nome_clean text := btrim(COALESCE(_nome,''));
  _rep_clean text := btrim(COALESCE(_representante,''));
  _id uuid; _codigo text; _loja_id uuid; _loja_owner uuid;
BEGIN
  IF length(_fone) >= 12 AND left(_fone, 2) = '55' THEN _fone := substr(_fone, 3); END IF;
  IF _nome_clean = '' THEN RAISE EXCEPTION 'Informe o nome da empresa'; END IF;
  IF length(_fone) NOT IN (10, 11) THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF length(_fone) = 11 AND substr(_fone, 3, 1) <> '9' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF substr(_fone, 1, 2)::int < 11 OR substr(_fone, 1, 2)::int > 99 THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF _fone ~ '^(\d)\1+$' THEN RAISE EXCEPTION 'WhatsApp inválido'; END IF;
  IF _cnpj_digits <> '' AND length(_cnpj_digits) <> 14 THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
  IF _pedido_minimo IS NOT NULL AND (_pedido_minimo < 0 OR _pedido_minimo > 10000000) THEN RAISE EXCEPTION 'Pedido mínimo inválido'; END IF;

  _fone_key := right(_fone, 10);

  IF _convite_loja IS NOT NULL THEN
    SELECT l.id, l.user_id INTO _loja_id, _loja_owner FROM public.lojas l WHERE l.id = _convite_loja;
  END IF;

  IF EXISTS (SELECT 1 FROM public.fornecedores f
    WHERE public.fornecedor_fone_key(f.telefone) = _fone_key AND f.consentimento_rede = 'sim'
      AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')) THEN
    IF _cnpj_digits = '' THEN RETURN jsonb_build_object('status', 'cnpj_obrigatorio'); END IF;
    IF EXISTS (SELECT 1 FROM public.fornecedores f
      WHERE public.fornecedor_fone_key(f.telefone) = _fone_key
        AND public.fornecedor_cnpj_key(f.cnpj) = _cnpj_digits AND f.consentimento_rede = 'sim'
        AND (f.user_id IS NULL OR f.origem_cadastro = 'autocadastro')) THEN
      RETURN jsonb_build_object('status', 'ja_cadastrado');
    END IF;
  END IF;

  INSERT INTO public.fornecedores (
    nome, representante, telefone, cnpj, tipo_fornecedor, pasta,
    token, consentimento_rede, consentimento_ultima_pergunta, origem_cadastro, user_id, convite_loja_id,
    pedido_minimo, prazo_pagamento
  ) VALUES (
    upper(_nome_clean), NULLIF(_rep_clean, ''), _fone, NULLIF(_cnpj_digits, ''),
    NULLIF(btrim(COALESCE(_tipo,'')), ''), _pastas,
    replace(gen_random_uuid()::text, '-', ''), 'sim', now(), 'autocadastro', _loja_owner, _loja_id,
    _pedido_minimo, NULLIF(left(btrim(COALESCE(_prazo_pagamento,'')), 120), '')
  ) RETURNING id INTO _id;

  IF _loja_id IS NOT NULL THEN
    INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id) VALUES (_id, _loja_id) ON CONFLICT DO NOTHING;
  END IF;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id, btrim(x->>'cidade'), NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''), public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  _codigo := lpad((floor(random() * 10000))::int::text, 4, '0');
  INSERT INTO public.fornecedor_acessos (fornecedor_id, fone_key, codigo, finalidade, expira_em)
  VALUES (_id, _fone_key, _codigo, 'cadastro', now() + interval '7 days');

  RETURN jsonb_build_object('status', 'ok', 'codigo', _codigo, 'fornecedor_id', _id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.cadastrar_fornecedor_parceiro(text, text, text, text, text, text[], jsonb, uuid, numeric, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.salvar_parceiro_dados(text, text, text, text, text[], jsonb, text);
CREATE FUNCTION public.salvar_parceiro_dados(_token text, _nome text, _representante text, _tipo text DEFAULT NULL, _pastas text[] DEFAULT NULL, _cidades jsonb DEFAULT NULL, _consentimento text DEFAULT NULL, _pedido_minimo numeric DEFAULT NULL, _prazo_pagamento text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _cons text := NULLIF(btrim(lower(COALESCE(_consentimento, ''))), '');
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;
  IF btrim(COALESCE(_nome,'')) = '' THEN RAISE EXCEPTION 'Informe o nome da empresa'; END IF;
  IF _cons IS NOT NULL AND _cons NOT IN ('sim', 'nao', 'pendente') THEN RAISE EXCEPTION 'Resposta de participação inválida'; END IF;
  IF _pedido_minimo IS NOT NULL AND (_pedido_minimo < 0 OR _pedido_minimo > 10000000) THEN RAISE EXCEPTION 'Pedido mínimo inválido'; END IF;

  UPDATE public.fornecedores f
    SET nome = upper(btrim(_nome)),
        representante = NULLIF(btrim(COALESCE(_representante,'')), ''),
        tipo_fornecedor = NULLIF(btrim(COALESCE(_tipo,'')), ''),
        pasta = CASE WHEN _pastas IS NOT NULL THEN _pastas ELSE f.pasta END,
        pedido_minimo = _pedido_minimo,
        prazo_pagamento = NULLIF(left(btrim(COALESCE(_prazo_pagamento,'')), 120), ''),
        consentimento_rede = COALESCE(_cons, f.consentimento_rede),
        consentimento_ultima_pergunta = CASE WHEN _cons IS NOT NULL THEN now() ELSE f.consentimento_ultima_pergunta END,
        consentimento_recusas = f.consentimento_recusas + CASE WHEN _cons = 'nao' THEN 1 ELSE 0 END,
        updated_at = now()
  WHERE f.id = _id;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    DELETE FROM public.fornecedor_cidades_atendidas c
    WHERE c.fornecedor_id = _id AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_cidades) x
        WHERE public.norm_cidade(x->>'cidade') = c.cidade_norm
          AND COALESCE(NULLIF(upper(btrim(COALESCE(x->>'uf',''))),''), '') = COALESCE(c.uf, ''));
    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id, btrim(x->>'cidade'), NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''), public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.salvar_parceiro_dados(text, text, text, text, text[], jsonb, text, numeric, text) TO anon, authenticated;