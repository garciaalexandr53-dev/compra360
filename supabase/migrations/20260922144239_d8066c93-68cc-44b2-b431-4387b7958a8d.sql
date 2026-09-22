ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS convite_loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.cadastrar_fornecedor_parceiro(
  _nome text,
  _representante text,
  _telefone text,
  _cnpj text DEFAULT NULL::text,
  _tipo text DEFAULT NULL::text,
  _pastas text[] DEFAULT NULL::text[],
  _cidades jsonb DEFAULT NULL::jsonb,
  _convite_loja uuid DEFAULT NULL::uuid
)
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
  _loja_id uuid;
  _loja_owner uuid;
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

  -- Convite rastreado: valida a loja que enviou o convite
  IF _convite_loja IS NOT NULL THEN
    SELECT l.id, l.user_id INTO _loja_id, _loja_owner
    FROM public.lojas l
    WHERE l.id = _convite_loja;
  END IF;

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
    token, consentimento_rede, consentimento_ultima_pergunta, origem_cadastro,
    user_id, convite_loja_id
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
    'autocadastro',
    _loja_owner,
    _loja_id
  )
  RETURNING id INTO _id;

  -- Vincula o fornecedor a loja que enviou o convite
  IF _loja_id IS NOT NULL THEN
    INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id)
    VALUES (_id, _loja_id)
    ON CONFLICT DO NOTHING;
  END IF;

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

  _codigo := lpad((floor(random() * 10000))::int::text, 4, '0');

  INSERT INTO public.fornecedor_acessos (fornecedor_id, fone_key, codigo, finalidade, expira_em)
  VALUES (_id, _fone_key, _codigo, 'cadastro', now() + interval '7 days');

  RETURN jsonb_build_object('status', 'ok', 'codigo', _codigo, 'fornecedor_id', _id);
END;
$function$;