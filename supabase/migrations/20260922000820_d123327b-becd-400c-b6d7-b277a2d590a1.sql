-- Marca a origem do cadastro do fornecedor (cliente x autocadastro na Rede)
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'cliente';

-- Autocadastro público de fornecedor/representante na Rede Compra360
CREATE OR REPLACE FUNCTION public.cadastrar_fornecedor_parceiro(
  _nome text,
  _representante text,
  _telefone text,
  _cnpj text DEFAULT NULL,
  _tipo text DEFAULT NULL,
  _pastas text[] DEFAULT NULL,
  _cidades jsonb DEFAULT NULL
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
  _status text;
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

  -- Anti-duplicidade: se o representante já existe na base (por telefone),
  -- enriquece a ficha existente em vez de criar outra.
  SELECT f.id INTO _id
  FROM public.fornecedores f
  WHERE right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 10) = _fone_key
    AND length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 10
  ORDER BY f.created_at DESC
  LIMIT 1;

  IF _id IS NULL THEN
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
    _status := 'criado';
  ELSE
    UPDATE public.fornecedores f
      SET consentimento_rede = 'sim',
          consentimento_ultima_pergunta = now(),
          representante = COALESCE(NULLIF(_rep_clean,''), f.representante),
          cnpj = COALESCE(NULLIF(_cnpj_digits,''), f.cnpj),
          tipo_fornecedor = COALESCE(NULLIF(btrim(COALESCE(_tipo,'')),''), f.tipo_fornecedor),
          pasta = CASE
            WHEN _pastas IS NOT NULL AND array_length(_pastas,1) > 0 THEN _pastas
            ELSE f.pasta
          END,
          origem_cadastro = CASE
            WHEN f.origem_cadastro = 'cliente' THEN 'autocadastro_confirmado'
            ELSE f.origem_cadastro
          END,
          updated_at = now()
    WHERE f.id = _id;
    _status := 'atualizado';
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

  RETURN jsonb_build_object('status', _status);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cadastrar_fornecedor_parceiro(text, text, text, text, text, text[], jsonb) TO anon, authenticated, service_role;