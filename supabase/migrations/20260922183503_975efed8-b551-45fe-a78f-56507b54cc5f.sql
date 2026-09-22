CREATE OR REPLACE FUNCTION public.admin_list_lojas_clientes(_search text DEFAULT NULL)
RETURNS TABLE(
  loja_id uuid,
  loja_nome text,
  cidade text,
  uf text,
  user_id uuid,
  cliente_nome text,
  cliente_email text,
  total_fornecedores bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    l.id AS loja_id,
    l.nome AS loja_nome,
    l.cidade,
    l.uf,
    l.user_id,
    COALESCE(NULLIF(btrim(pr.nome), ''), NULLIF(btrim(l.razao_social), '')) AS cliente_nome,
    u.email::text AS cliente_email,
    (SELECT COUNT(*) FROM public.fornecedor_lojas fl WHERE fl.loja_id = l.id) AS total_fornecedores
  FROM public.lojas l
  LEFT JOIN public.profiles pr ON pr.user_id = l.user_id
  LEFT JOIN auth.users u ON u.id = l.user_id
  WHERE l.user_id IS NOT NULL
    AND (
      _search IS NULL OR btrim(_search) = '' OR
      l.nome ILIKE '%' || _search || '%' OR
      COALESCE(l.cidade, '') ILIKE '%' || _search || '%' OR
      COALESCE(l.razao_social, '') ILIKE '%' || _search || '%' OR
      COALESCE(pr.nome, '') ILIKE '%' || _search || '%' OR
      COALESCE(u.email::text, '') ILIKE '%' || _search || '%'
    )
  ORDER BY COALESCE(NULLIF(btrim(pr.nome), ''), u.email::text) ASC, l.nome ASC
  LIMIT 200;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_lojas_clientes(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_lojas_clientes(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_lojas_clientes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_lojas_clientes(text) TO service_role;


CREATE OR REPLACE FUNCTION public.admin_vincular_fornecedores_loja(_loja_id uuid, _fornecedor_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dono uuid;
  _criados int := 0;
  _vinculados int := 0;
  _ja int := 0;
  _fid uuid;
  _alvo uuid;
  _tel_key text;
  _nome_norm text;
  _rep_norm text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT l.user_id INTO _dono FROM public.lojas l WHERE l.id = _loja_id;
  IF _dono IS NULL THEN
    RAISE EXCEPTION 'Loja inválida ou sem cliente vinculado';
  END IF;

  IF _fornecedor_ids IS NULL OR array_length(_fornecedor_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('criados', 0, 'vinculados', 0, 'ja_vinculados', 0);
  END IF;

  FOREACH _fid IN ARRAY _fornecedor_ids LOOP
    _alvo := NULL;

    SELECT right(regexp_replace(COALESCE(f.telefone, ''), '\D', '', 'g'), 8),
           lower(regexp_replace(translate(COALESCE(f.nome, ''),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]', '', 'g')),
           lower(regexp_replace(translate(COALESCE(f.representante, ''),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]', '', 'g'))
      INTO _tel_key, _nome_norm, _rep_norm
    FROM public.fornecedores f WHERE f.id = _fid;

    IF _nome_norm IS NULL THEN
      CONTINUE;
    END IF;

    -- Já existe na carteira do cliente?
    SELECT f2.id INTO _alvo
    FROM public.fornecedores f2
    WHERE f2.user_id = _dono
      AND (
        (_tel_key <> '' AND right(regexp_replace(COALESCE(f2.telefone, ''), '\D', '', 'g'), 8) = _tel_key)
        OR (
          lower(regexp_replace(translate(COALESCE(f2.nome, ''),
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]', '', 'g')) = _nome_norm
          AND lower(regexp_replace(translate(COALESCE(f2.representante, ''),
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^a-zA-Z0-9]', '', 'g')) = _rep_norm
        )
      )
    ORDER BY f2.created_at ASC
    LIMIT 1;

    IF _alvo IS NULL THEN
      INSERT INTO public.fornecedores (
        nome, representante, telefone, email, pedido_minimo, prazo_pagamento,
        observacoes, tipo_fornecedor, pasta, cnpj, user_id, token
      )
      SELECT f.nome, f.representante, f.telefone, f.email, f.pedido_minimo, f.prazo_pagamento,
             f.observacoes, f.tipo_fornecedor, f.pasta, f.cnpj, _dono,
             replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
      FROM public.fornecedores f WHERE f.id = _fid
      RETURNING id INTO _alvo;

      INSERT INTO public.fornecedor_cidades_atendidas (fornecedor_id, cidade, uf, cidade_norm)
      SELECT _alvo, c.cidade, c.uf, c.cidade_norm
      FROM public.fornecedor_cidades_atendidas c
      WHERE c.fornecedor_id = _fid;

      _criados := _criados + 1;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.fornecedor_lojas fl
      WHERE fl.fornecedor_id = _alvo AND fl.loja_id = _loja_id
    ) THEN
      _ja := _ja + 1;
    ELSE
      INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id) VALUES (_alvo, _loja_id);
      _vinculados := _vinculados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('criados', _criados, 'vinculados', _vinculados, 'ja_vinculados', _ja);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_vincular_fornecedores_loja(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_vincular_fornecedores_loja(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_vincular_fornecedores_loja(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_vincular_fornecedores_loja(uuid, uuid[]) TO service_role;