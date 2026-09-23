-- ============ Sugestões da região com chave universal de telefone/CNPJ ============
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
    SELECT public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
           public.norm_cidade(f.nome) AS nome_norm,
           public.norm_cidade(COALESCE(f.representante, '')) AS rep_norm
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
      public.fornecedor_fone_key(b.telefone) AS fone_key,
      public.fornecedor_cnpj_key(b.cnpj) AS cnpj_key,
      public.norm_cidade(b.nome) AS nome_norm,
      public.norm_cidade(COALESCE(b.representante, '')) AS rep_norm,
      length(regexp_replace(COALESCE(b.telefone,''), '\D', '', 'g')) AS fone_digitos
    FROM base b
  ),
  sem_meus AS (
    SELECT c.* FROM cand c
    WHERE NOT EXISTS (
      SELECT 1 FROM meus m
      WHERE (c.fone_key IS NOT NULL AND m.fone_key = c.fone_key)
         OR (c.cnpj_key IS NOT NULL AND m.cnpj_key = c.cnpj_key)
         OR (c.fone_key IS NULL AND c.cnpj_key IS NULL
             AND m.nome_norm = c.nome_norm AND m.rep_norm = c.rep_norm)
    )
  ),
  chaveado AS (
    SELECT s.*,
      COALESCE('f:' || s.fone_key, 'c:' || s.cnpj_key,
               'n:' || s.nome_norm || '|' || s.rep_norm) AS grupo_key
    FROM sem_meus s
  ),
  dedup AS (
    SELECT DISTINCT ON (k.grupo_key) k.*
    FROM chaveado k
    ORDER BY
      k.grupo_key,
      (k.cnpj_key IS NOT NULL) DESC,
      (k.fone_digitos >= 11) DESC,
      (k.prazo_pagamento IS NOT NULL) DESC,
      (k.pedido_minimo IS NOT NULL) DESC,
      (COALESCE(array_length(k.pasta, 1), 0)) DESC,
      k.created_at DESC
  )
  SELECT d.id, d.nome, d.representante, d.telefone, d.tipo_fornecedor, d.pasta,
         d.pedido_minimo, d.prazo_pagamento
  FROM dedup d
  ORDER BY d.nome_norm ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) TO authenticated, service_role;

-- ============ Cópia para a loja: leva CNPJ/consentimento e nunca duplica ============
CREATE OR REPLACE FUNCTION public.copiar_fornecedores_para_loja(_loja_id uuid, _fornecedor_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _total integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = _loja_id AND l.user_id = _uid) THEN
    RAISE EXCEPTION 'Loja não pertence ao usuário';
  END IF;

  IF _fornecedor_ids IS NULL OR array_length(_fornecedor_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  WITH meus AS (
    SELECT public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
           public.norm_cidade(f.nome) AS nome_norm,
           public.norm_cidade(COALESCE(f.representante, '')) AS rep_norm
    FROM public.fornecedores f
    WHERE f.user_id = _uid
  ),
  origem AS (
    SELECT DISTINCT ON (
      COALESCE('f:' || public.fornecedor_fone_key(f.telefone),
               'c:' || public.fornecedor_cnpj_key(f.cnpj),
               'n:' || public.norm_cidade(f.nome) || '|' || public.norm_cidade(COALESCE(f.representante, '')))
    ) f.*
    FROM public.fornecedores f
    WHERE f.id = ANY(_fornecedor_ids)
      AND (f.user_id IS NULL OR f.user_id <> _uid)
    ORDER BY
      COALESCE('f:' || public.fornecedor_fone_key(f.telefone),
               'c:' || public.fornecedor_cnpj_key(f.cnpj),
               'n:' || public.norm_cidade(f.nome) || '|' || public.norm_cidade(COALESCE(f.representante, ''))),
      (public.fornecedor_cnpj_key(f.cnpj) IS NOT NULL) DESC,
      (length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 11) DESC,
      f.created_at DESC
  ),
  filtrados AS (
    SELECT o.* FROM origem o
    WHERE NOT EXISTS (
      SELECT 1 FROM meus m
      WHERE (public.fornecedor_fone_key(o.telefone) IS NOT NULL
             AND m.fone_key = public.fornecedor_fone_key(o.telefone))
         OR (public.fornecedor_cnpj_key(o.cnpj) IS NOT NULL
             AND m.cnpj_key = public.fornecedor_cnpj_key(o.cnpj))
         OR (public.fornecedor_fone_key(o.telefone) IS NULL
             AND public.fornecedor_cnpj_key(o.cnpj) IS NULL
             AND m.nome_norm = public.norm_cidade(o.nome)
             AND m.rep_norm = public.norm_cidade(COALESCE(o.representante, '')))
    )
  ),
  novos AS (
    INSERT INTO public.fornecedores (
      nome, representante, telefone, email, pedido_minimo, prazo_pagamento,
      observacoes, tipo_fornecedor, pasta, cnpj, consentimento_rede, user_id, token
    )
    SELECT f.nome, f.representante, f.telefone, f.email, f.pedido_minimo, f.prazo_pagamento,
           f.observacoes, f.tipo_fornecedor, f.pasta, f.cnpj, f.consentimento_rede, _uid,
           replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    FROM filtrados f
    RETURNING id
  ),
  vinculos AS (
    INSERT INTO public.fornecedor_lojas (fornecedor_id, loja_id)
    SELECT n.id, _loja_id FROM novos n
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO _total FROM vinculos;

  RETURN COALESCE(_total, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) TO authenticated, service_role;