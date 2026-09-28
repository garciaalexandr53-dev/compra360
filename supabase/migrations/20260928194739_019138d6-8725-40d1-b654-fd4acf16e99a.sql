CREATE OR REPLACE FUNCTION public.desvincular_parceiro_empresa(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.fornecedores;
  _fone_key text;
  _cnpj_key text;
  _nome text;
  _aviso text;
  _proximo jsonb;
BEGIN
  SELECT * INTO _row FROM public.fornecedores WHERE token = _token LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'link_invalido');
  END IF;

  _fone_key := public.fornecedor_fone_key(_row.telefone);
  _cnpj_key := public.fornecedor_cnpj_key(_row.cnpj);
  _nome := _row.nome;
  _aviso := '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
            || ' - o representante informou que nao atende mais esta empresa. Confirme um novo contato.]';

  -- Proxima empresa do mesmo WhatsApp (antes de limpar o telefone desta ficha)
  SELECT jsonb_build_object('nome', f.nome, 'token', f.token) INTO _proximo
  FROM public.fornecedores f
  WHERE f.id <> _row.id
    AND f.user_id IS NULL
    AND public.fornecedor_fone_key(f.telefone) = _fone_key
    AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '') <> COALESCE(_cnpj_key, '#')
  ORDER BY f.created_at DESC
  LIMIT 1;

  -- Ficha da Rede: sai das sugestoes, libera o telefone e invalida o link
  UPDATE public.fornecedores f
    SET consentimento_rede = 'nao',
        telefone = NULL,
        representante = NULL,
        token = encode(gen_random_bytes(16), 'hex'),
        observacoes = btrim(COALESCE(f.observacoes || E'\n', '') || _aviso),
        updated_at = now()
  WHERE f.id = _row.id
    AND f.user_id IS NULL;

  -- Se a ficha pertence a uma loja, nada e removido: apenas avisa o comprador
  UPDATE public.fornecedores f
    SET observacoes = btrim(COALESCE(f.observacoes || E'\n', '') || _aviso),
        updated_at = now()
  WHERE f.user_id IS NOT NULL
    AND public.fornecedor_fone_key(f.telefone) = _fone_key
    AND COALESCE(public.fornecedor_cnpj_key(f.cnpj), '#') = COALESCE(_cnpj_key, '#')
    AND COALESCE(f.observacoes, '') NOT LIKE '%nao atende mais esta empresa%';

  -- Codigos de acesso pendentes desta ficha deixam de valer
  DELETE FROM public.fornecedor_acessos a
  WHERE a.fornecedor_id = _row.id AND a.confirmado_em IS NULL;

  RETURN jsonb_build_object('ok', true, 'nome', _nome, 'proxima', _proximo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.desvincular_parceiro_empresa(text) TO anon, authenticated, service_role;