CREATE OR REPLACE FUNCTION public.admin_list_fornecedores(
  _search text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  nome text,
  representante text,
  telefone text,
  email text,
  pedido_minimo numeric,
  prazo_pagamento text,
  created_at timestamp with time zone,
  user_id uuid,
  cliente_nome text,
  cliente_empresa text,
  cliente_email text,
  cidade text,
  uf text,
  lojas_vinculadas bigint,
  duplicado boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      f.id, f.nome, f.representante, f.telefone, f.email,
      f.pedido_minimo, f.prazo_pagamento, f.created_at, f.user_id,
      lower(btrim(regexp_replace(f.nome, '\s+', ' ', 'g'))) AS nome_norm,
      (SELECT pr.nome FROM public.profiles pr
         WHERE pr.user_id = f.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
         LIMIT 1) AS cliente_nome,
      (SELECT l.nome FROM public.lojas l WHERE l.user_id = f.user_id
         ORDER BY l.created_at ASC LIMIT 1) AS cliente_empresa,
      (SELECT u.email::text FROM auth.users u WHERE u.id = f.user_id) AS cliente_email,
      (SELECT l.cidade FROM public.lojas l WHERE l.user_id = f.user_id AND l.cidade IS NOT NULL
         ORDER BY l.created_at ASC LIMIT 1) AS cidade,
      (SELECT l.uf FROM public.lojas l WHERE l.user_id = f.user_id AND l.uf IS NOT NULL
         ORDER BY l.created_at ASC LIMIT 1) AS uf,
      (SELECT COUNT(*) FROM public.fornecedor_lojas fl WHERE fl.fornecedor_id = f.id) AS lojas_vinculadas
    FROM public.fornecedores f
  ),
  marcado AS (
    SELECT b.*,
      (COUNT(*) OVER (PARTITION BY b.nome_norm) > 1) AS duplicado
    FROM base b
  ),
  filtrado AS (
    SELECT * FROM marcado m
    WHERE _search IS NULL OR btrim(_search) = ''
      OR m.nome ILIKE '%' || _search || '%'
      OR COALESCE(m.representante, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.telefone, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.email, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.cliente_empresa, '') ILIKE '%' || _search || '%'
      OR COALESCE(m.cliente_nome, '') ILIKE '%' || _search || '%'
  )
  SELECT
    fi.id, fi.nome, fi.representante, fi.telefone, fi.email,
    fi.pedido_minimo, fi.prazo_pagamento, fi.created_at, fi.user_id,
    fi.cliente_nome, fi.cliente_empresa, fi.cliente_email,
    fi.cidade, fi.uf, fi.lojas_vinculadas, fi.duplicado,
    COUNT(*) OVER()::bigint AS total_count
  FROM filtrado fi
  ORDER BY fi.nome ASC, fi.created_at ASC
  LIMIT _limit OFFSET _offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_fornecedor_detalhes(_fornecedor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'id', f.id,
    'nome', f.nome,
    'representante', f.representante,
    'telefone', f.telefone,
    'email', f.email,
    'pedido_minimo', f.pedido_minimo,
    'prazo_pagamento', f.prazo_pagamento,
    'observacoes', f.observacoes,
    'created_at', f.created_at,
    'user_id', f.user_id,
    'cliente_nome', (SELECT pr.nome FROM public.profiles pr
                       WHERE pr.user_id = f.user_id AND pr.nome IS NOT NULL AND btrim(pr.nome) <> ''
                       LIMIT 1),
    'cliente_email', (SELECT u.email::text FROM auth.users u WHERE u.id = f.user_id),
    'cliente_empresa', (SELECT l.nome FROM public.lojas l WHERE l.user_id = f.user_id
                          ORDER BY l.created_at ASC LIMIT 1),
    'lojas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cidade', l.cidade, 'uf', l.uf)
                       ORDER BY l.nome)
      FROM public.fornecedor_lojas fl
      JOIN public.lojas l ON l.id = fl.loja_id
      WHERE fl.fornecedor_id = f.id
    ), '[]'::jsonb),
    'cotacoes_recebidas', (SELECT COUNT(*) FROM public.cotacao_fornecedores cf WHERE cf.fornecedor_id = f.id),
    'cotacoes_respondidas', (
      SELECT COUNT(DISTINCT cp.cotacao_id)
      FROM public.precos p
      JOIN public.cotacao_produtos cp ON cp.id = p.cotacao_produto_id
      WHERE p.fornecedor_id = f.id
    ),
    'ultima_resposta_at', (
      SELECT MAX(p.updated_at) FROM public.precos p WHERE p.fornecedor_id = f.id
    )
  ) INTO result
  FROM public.fornecedores f
  WHERE f.id = _fornecedor_id;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_fornecedor(
  _fornecedor_id uuid,
  _nome text,
  _representante text DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _pedido_minimo numeric DEFAULT NULL,
  _prazo_pagamento text DEFAULT NULL,
  _observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _owner uuid;
  _antes public.fornecedores;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RAISE EXCEPTION 'Nome do fornecedor é obrigatório';
  END IF;

  SELECT * INTO _antes FROM public.fornecedores WHERE id = _fornecedor_id;
  IF _antes.id IS NULL THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;
  _owner := _antes.user_id;

  UPDATE public.fornecedores SET
    nome = btrim(_nome),
    representante = NULLIF(btrim(COALESCE(_representante, '')), ''),
    telefone = NULLIF(btrim(COALESCE(_telefone, '')), ''),
    email = NULLIF(btrim(COALESCE(_email, '')), ''),
    pedido_minimo = _pedido_minimo,
    prazo_pagamento = NULLIF(btrim(COALESCE(_prazo_pagamento, '')), ''),
    observacoes = NULLIF(btrim(COALESCE(_observacoes, '')), ''),
    updated_at = now()
  WHERE id = _fornecedor_id;

  IF _owner IS NOT NULL THEN
    INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
    VALUES (
      _owner, 'email', 'manual',
      'Fornecedor atualizado pelo suporte: ' || _antes.nome ||
        CASE WHEN btrim(_nome) <> _antes.nome THEN ' → ' || btrim(_nome) ELSE '' END ||
        CASE WHEN COALESCE(_telefone, '') <> COALESCE(_antes.telefone, '')
             THEN ' | telefone: ' || COALESCE(_antes.telefone, '—') || ' → ' || COALESCE(NULLIF(btrim(COALESCE(_telefone,'')),''), '—')
             ELSE '' END ||
        CASE WHEN COALESCE(_representante, '') <> COALESCE(_antes.representante, '')
             THEN ' | representante: ' || COALESCE(_antes.representante, '—') || ' → ' || COALESCE(NULLIF(btrim(COALESCE(_representante,'')),''), '—')
             ELSE '' END,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;