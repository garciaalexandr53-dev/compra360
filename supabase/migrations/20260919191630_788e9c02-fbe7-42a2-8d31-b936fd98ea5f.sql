CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sugerir_fornecedores_por_cidade(_loja_id uuid)
RETURNS TABLE(
  id uuid, nome text, representante text, telefone text,
  tipo_fornecedor text, pasta text[], pedido_minimo numeric, prazo_pagamento text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cidade_norm text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT btrim(regexp_replace(
           lower(translate(COALESCE(l.cidade, ''),
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
             'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
           '\s+', ' ', 'g'))
    INTO _cidade_norm
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
  cand AS (
    SELECT DISTINCT
      f.id, f.nome, f.representante, f.telefone, f.tipo_fornecedor, f.pasta,
      f.pedido_minimo, f.prazo_pagamento, f.created_at,
      CASE
        WHEN length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) >= 12
          AND left(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'), 2) = '55'
          THEN right(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g'),
                     length(regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')) - 2)
        ELSE regexp_replace(COALESCE(f.telefone,''), '\D', '', 'g')
      END AS fone_digits,
      btrim(regexp_replace(regexp_replace(
        lower(translate(f.nome,
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS nome_norm,
      btrim(regexp_replace(regexp_replace(
        lower(translate(COALESCE(f.representante, ''),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
          'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS rep_norm
    FROM public.fornecedores f
    JOIN public.fornecedor_lojas fl ON fl.fornecedor_id = f.id
    JOIN public.lojas l ON l.id = fl.loja_id
    WHERE fl.loja_id <> _loja_id
      AND (f.user_id IS NULL OR f.user_id <> _uid)
      AND btrim(regexp_replace(
            lower(translate(COALESCE(l.cidade, ''),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
              'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
            '\s+', ' ', 'g')) = _cidade_norm
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
$$;

REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.copiar_fornecedores_para_loja(_loja_id uuid, _fornecedor_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  WITH novos AS (
    INSERT INTO public.fornecedores (
      nome, representante, telefone, email, pedido_minimo, prazo_pagamento,
      observacoes, tipo_fornecedor, pasta, user_id, token
    )
    SELECT f.nome, f.representante, f.telefone, f.email, f.pedido_minimo, f.prazo_pagamento,
           f.observacoes, f.tipo_fornecedor, f.pasta, _uid,
           encode(gen_random_bytes(16), 'hex')
    FROM public.fornecedores f
    WHERE f.id = ANY(_fornecedor_ids)
      AND (f.user_id IS NULL OR f.user_id <> _uid)
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
$$;

REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM anon;