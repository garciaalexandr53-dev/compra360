CREATE OR REPLACE FUNCTION public.admin_update_loja(_loja_id uuid, _cidade text DEFAULT NULL::text, _uf text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _antes public.lojas;
  _cid text;
  _uf2 text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT * INTO _antes FROM public.lojas WHERE id = _loja_id;
  IF _antes.id IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  _cid := NULLIF(btrim(COALESCE(_cidade, '')), '');
  _uf2 := NULLIF(upper(btrim(COALESCE(_uf, ''))), '');
  IF _uf2 IS NOT NULL AND length(_uf2) <> 2 THEN
    RAISE EXCEPTION 'UF inválida';
  END IF;

  UPDATE public.lojas SET cidade = _cid, uf = _uf2 WHERE id = _loja_id;

  IF _antes.user_id IS NOT NULL
     AND (COALESCE(_cid, '') <> COALESCE(_antes.cidade, '') OR COALESCE(_uf2, '') <> COALESCE(_antes.uf, '')) THEN
    INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
    VALUES (
      _antes.user_id, 'email', 'manual',
      'Loja atualizada pelo suporte: ' || _antes.nome ||
        CASE WHEN COALESCE(_cid, '') <> COALESCE(_antes.cidade, '')
             THEN ' | cidade: ' || COALESCE(_antes.cidade, '—') || ' → ' || COALESCE(_cid, '—') ELSE '' END ||
        CASE WHEN COALESCE(_uf2, '') <> COALESCE(_antes.uf, '')
             THEN ' | uf: ' || COALESCE(_antes.uf, '—') || ' → ' || COALESCE(_uf2, '—') ELSE '' END,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_cliente_detalhes(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  SELECT jsonb_build_object(
    'last_sign_in_at', (SELECT u.last_sign_in_at FROM auth.users u WHERE u.id = _user_id),
    'telefone', (SELECT pr.whatsapp FROM public.profiles pr WHERE pr.user_id = _user_id LIMIT 1),
    'subscription_started_at', (
      SELECT s.current_period_start FROM public.subscriptions s
       WHERE s.user_id = _user_id AND s.status IN ('active','trialing')
       ORDER BY s.created_at DESC LIMIT 1
    ),
    'current_period_end', (
      SELECT s.current_period_end FROM public.subscriptions s
       WHERE s.user_id = _user_id
       ORDER BY s.created_at DESC LIMIT 1
    ),
    'subscription_created_at', (
      SELECT s.created_at FROM public.subscriptions s
       WHERE s.user_id = _user_id
       ORDER BY s.created_at ASC LIMIT 1
    ),
    'plan_price_monthly', (
      SELECT p.price_monthly FROM public.subscriptions s
       JOIN public.plans p ON p.id = s.plan_id
       WHERE s.user_id = _user_id AND s.status IN ('active','trialing')
       ORDER BY s.created_at DESC LIMIT 1
    ),
    'lojas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'nome', l.nome, 'nome_fantasia', l.nome_fantasia,
               'cidade', l.cidade, 'uf', l.uf
             ) ORDER BY l.nome)
        FROM public.lojas l WHERE l.user_id = _user_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_fornecedor(_fornecedor_id uuid, _nome text, _representante text DEFAULT NULL::text, _telefone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _pedido_minimo numeric DEFAULT NULL::numeric, _prazo_pagamento text DEFAULT NULL::text, _observacoes text DEFAULT NULL::text, _tipo_fornecedor text DEFAULT NULL::text, _pasta text[] DEFAULT NULL::text[], _consentimento_rede text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _antes public.fornecedores;
  _tipo text;
  _pastas text[];
  _cons text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _nome IS NULL OR btrim(_nome) = '' THEN
    RAISE EXCEPTION 'Nome do fornecedor é obrigatório';
  END IF;

  _tipo := NULLIF(btrim(COALESCE(_tipo_fornecedor, '')), '');
  IF _tipo IS NOT NULL AND _tipo NOT IN ('geral', 'bebidas', 'especializado') THEN
    RAISE EXCEPTION 'Tipo de fornecedor inválido';
  END IF;

  _cons := NULLIF(btrim(lower(COALESCE(_consentimento_rede, ''))), '');
  IF _cons IS NOT NULL AND _cons NOT IN ('pendente', 'sim', 'nao') THEN
    RAISE EXCEPTION 'Consentimento inválido';
  END IF;

  IF _tipo = 'especializado' THEN
    _pastas := NULLIF(COALESCE(_pasta, ARRAY[]::text[]), ARRAY[]::text[]);
  ELSE
    _pastas := NULL;
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
    tipo_fornecedor = _tipo,
    pasta = _pastas,
    consentimento_rede = COALESCE(_cons, consentimento_rede),
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
             ELSE '' END ||
        CASE WHEN COALESCE(_tipo, '') <> COALESCE(_antes.tipo_fornecedor, '')
             THEN ' | tipo: ' || COALESCE(_antes.tipo_fornecedor, '—') || ' → ' || COALESCE(_tipo, '—')
             ELSE '' END ||
        CASE WHEN _cons IS NOT NULL AND _cons <> COALESCE(_antes.consentimento_rede, '')
             THEN ' | consentimento: ' || COALESCE(_antes.consentimento_rede, '—') || ' → ' || _cons
             ELSE '' END,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_fornecedor(uuid, text, text, text, text, numeric, text, text, text, text[], text) TO authenticated, service_role;