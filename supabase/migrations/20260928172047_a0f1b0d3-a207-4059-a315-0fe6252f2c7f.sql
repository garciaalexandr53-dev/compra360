-- Portal do parceiro: participacao na Rede passa a ser escolha explicita
DROP FUNCTION IF EXISTS public.salvar_parceiro_dados(text, text, text, text, text[], jsonb);

CREATE OR REPLACE FUNCTION public.salvar_parceiro_dados(
  _token text,
  _nome text,
  _representante text,
  _tipo text DEFAULT NULL::text,
  _pastas text[] DEFAULT NULL::text[],
  _cidades jsonb DEFAULT NULL::jsonb,
  _consentimento text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _cons text := NULLIF(btrim(lower(COALESCE(_consentimento, ''))), '');
BEGIN
  SELECT id INTO _id FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;
  IF btrim(COALESCE(_nome,'')) = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;
  IF _cons IS NOT NULL AND _cons NOT IN ('sim', 'nao', 'pendente') THEN
    RAISE EXCEPTION 'Resposta de participação inválida';
  END IF;

  UPDATE public.fornecedores f
    SET nome = upper(btrim(_nome)),
        representante = NULLIF(btrim(COALESCE(_representante,'')), ''),
        tipo_fornecedor = NULLIF(btrim(COALESCE(_tipo,'')), ''),
        pasta = CASE WHEN _pastas IS NOT NULL THEN _pastas ELSE f.pasta END,
        consentimento_rede = COALESCE(_cons, f.consentimento_rede),
        consentimento_ultima_pergunta = CASE WHEN _cons IS NOT NULL THEN now()
                                             ELSE f.consentimento_ultima_pergunta END,
        consentimento_recusas = f.consentimento_recusas + CASE WHEN _cons = 'nao' THEN 1 ELSE 0 END,
        updated_at = now()
  WHERE f.id = _id;

  IF _cidades IS NOT NULL AND jsonb_typeof(_cidades) = 'array' THEN
    DELETE FROM public.fornecedor_cidades_atendidas c
    WHERE c.fornecedor_id = _id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(_cidades) x
        WHERE public.norm_cidade(x->>'cidade') = c.cidade_norm
          AND COALESCE(NULLIF(upper(btrim(COALESCE(x->>'uf',''))),''), '') = COALESCE(c.uf, '')
      );

    INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
    SELECT DISTINCT _id,
           btrim(x->>'cidade'),
           NULLIF(upper(btrim(COALESCE(x->>'uf',''))), ''),
           public.norm_cidade(x->>'cidade')
    FROM jsonb_array_elements(_cidades) x
    WHERE btrim(COALESCE(x->>'cidade','')) <> ''
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_parceiro_dados(text, text, text, text, text[], jsonb, text) TO anon, authenticated, service_role;

-- Dados do parceiro passam a informar a situacao de participacao na Rede
CREATE OR REPLACE FUNCTION public.get_parceiro_dados(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.fornecedores;
BEGIN
  SELECT * INTO _row FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _row.id IS NULL THEN RETURN jsonb_build_object('encontrado', false); END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'nome', _row.nome,
    'representante', _row.representante,
    'telefone', _row.telefone,
    'cnpj', _row.cnpj,
    'tipo_fornecedor', _row.tipo_fornecedor,
    'pasta', to_jsonb(COALESCE(_row.pasta, ARRAY[]::text[])),
    'pedido_minimo', _row.pedido_minimo,
    'prazo_pagamento', _row.prazo_pagamento,
    'consentimento_rede', _row.consentimento_rede,
    'cidades', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cidade', c.cidade, 'uf', COALESCE(c.uf, '')) ORDER BY c.cidade)
      FROM public.fornecedor_cidades_atendidas c WHERE c.fornecedor_id = _row.id
    ), '[]'::jsonb),
    'outras_empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', x.nome, 'token', x.token) ORDER BY x.nome)
      FROM (
        SELECT DISTINCT ON (COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text)) f.nome, f.token
        FROM public.fornecedores f
        WHERE f.id <> _row.id
          AND public.fornecedor_fone_key(f.telefone) = public.fornecedor_fone_key(_row.telefone)
          AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '') <> COALESCE(public.fornecedor_cnpj_key(_row.cnpj), '#')
        ORDER BY COALESCE(public.fornecedor_cnpj_key(f.cnpj), f.id::text), f.created_at DESC
      ) x
    ), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parceiro_dados(text) TO anon, authenticated, service_role;
