CREATE OR REPLACE FUNCTION public._fornecedor_convocacoes()
RETURNS TABLE(fornecedor_id uuid, loja_id uuid, respondeu boolean, horas numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cf.fornecedor_id, co.loja_id,
         r.primeira IS NOT NULL,
         CASE WHEN r.primeira IS NOT NULL
              THEN GREATEST(0, EXTRACT(EPOCH FROM (r.primeira - COALESCE(cf.enviado_em, cf.created_at))) / 3600.0) END
  FROM public.cotacao_fornecedores cf
  JOIN public.cotacoes co ON co.id = cf.cotacao_id
  LEFT JOIN LATERAL (
    SELECT min(p.updated_at) AS primeira
    FROM public.precos p JOIN public.cotacao_produtos cp ON cp.id = p.cotacao_produto_id
    WHERE cp.cotacao_id = cf.cotacao_id AND p.fornecedor_id = cf.fornecedor_id
  ) r ON true
  WHERE cf.enviado_em IS NOT NULL OR co.status = 'finalizada' OR r.primeira IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public._fornecedor_convocacoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._fornecedor_convocacoes() TO service_role;

DROP FUNCTION IF EXISTS public.sugerir_fornecedores_por_cidade(uuid);
CREATE FUNCTION public.sugerir_fornecedores_por_cidade(_loja_id uuid)
 RETURNS TABLE(id uuid, nome text, representante text, telefone text, tipo_fornecedor text, pasta text[], pedido_minimo numeric, prazo_pagamento text, total_cotacoes integer, total_respondidas integer, tempo_medio_horas numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cidade_norm text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT public.norm_cidade(l.cidade) INTO _cidade_norm
  FROM public.lojas l WHERE l.id = _loja_id AND l.user_id = _uid;
  IF _cidade_norm IS NULL OR _cidade_norm = '' THEN RETURN; END IF;

  RETURN QUERY
  WITH meus AS (
    SELECT public.fornecedor_fone_key(f.telefone) AS fone_key,
           public.fornecedor_cnpj_key(f.cnpj) AS cnpj_key,
           public.norm_cidade(f.nome) AS nome_norm,
           public.norm_cidade(COALESCE(f.representante, '')) AS rep_norm
    FROM public.fornecedores f WHERE f.user_id = _uid
  ),
  base AS (
    SELECT f.* FROM public.fornecedores f
    WHERE (f.user_id IS NULL OR f.user_id <> _uid)
      AND f.consentimento_rede = 'sim'
      AND NOT EXISTS (SELECT 1 FROM public.fornecedor_lojas fl2 WHERE fl2.fornecedor_id = f.id AND fl2.loja_id = _loja_id)
      AND (
        EXISTS (SELECT 1 FROM public.fornecedor_cidades_atendidas c WHERE c.fornecedor_id = f.id AND c.cidade_norm = _cidade_norm)
        OR EXISTS (
          SELECT 1 FROM public.fornecedor_lojas fl JOIN public.lojas l ON l.id = fl.loja_id
          WHERE fl.fornecedor_id = f.id AND fl.loja_id <> _loja_id AND public.norm_cidade(l.cidade) = _cidade_norm)
      )
  ),
  cand AS (
    SELECT b.id, b.nome, b.representante, b.telefone, b.tipo_fornecedor, b.pasta,
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
         OR (c.fone_key IS NULL AND c.cnpj_key IS NULL AND m.nome_norm = c.nome_norm AND m.rep_norm = c.rep_norm))
  ),
  chaveado AS (
    SELECT s.*, COALESCE('f:' || s.fone_key, 'c:' || s.cnpj_key, 'n:' || s.nome_norm || '|' || s.rep_norm) AS grupo_key
    FROM sem_meus s
  ),
  dedup AS (
    SELECT DISTINCT ON (k.grupo_key) k.* FROM chaveado k
    ORDER BY k.grupo_key, (k.cnpj_key IS NOT NULL) DESC, (k.fone_digitos >= 11) DESC,
      (k.prazo_pagamento IS NOT NULL) DESC, (k.pedido_minimo IS NOT NULL) DESC,
      (COALESCE(array_length(k.pasta, 1), 0)) DESC, k.created_at DESC
  ),
  conv AS (SELECT * FROM public._fornecedor_convocacoes())
  SELECT d.id, d.nome, d.representante, d.telefone, d.tipo_fornecedor, d.pasta,
         d.pedido_minimo, d.prazo_pagamento,
         COALESCE(st.total, 0)::int, COALESCE(st.resp, 0)::int, st.horas
  FROM dedup d
  LEFT JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE cv.respondeu) AS resp, round(avg(cv.horas), 1) AS horas
    FROM conv cv JOIN public.fornecedores f2 ON f2.id = cv.fornecedor_id
    WHERE f2.id = d.id
       OR (d.fone_key IS NOT NULL AND public.fornecedor_fone_key(f2.telefone) = d.fone_key)
       OR (d.cnpj_key IS NOT NULL AND public.fornecedor_cnpj_key(f2.cnpj) = d.cnpj_key)
  ) st ON true
  ORDER BY d.nome_norm ASC;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sugerir_fornecedores_por_cidade(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_desempenho_fornecedores_loja(_loja_id uuid)
RETURNS TABLE(fornecedor_id uuid, total_cotacoes integer, total_respondidas integer, tempo_medio_horas numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cv.fornecedor_id, count(*)::int, count(*) FILTER (WHERE cv.respondeu)::int, round(avg(cv.horas), 1)
  FROM public._fornecedor_convocacoes() cv
  WHERE auth.uid() IS NOT NULL
    AND cv.loja_id = _loja_id
    AND EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = _loja_id AND l.user_id = auth.uid())
  GROUP BY cv.fornecedor_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_desempenho_fornecedores_loja(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_desempenho_fornecedores_loja(uuid) TO authenticated, service_role;