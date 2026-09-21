ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS bairro text;

CREATE OR REPLACE FUNCTION public.admin_update_loja(
  _loja_id uuid,
  _cidade text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _cep text DEFAULT NULL,
  _endereco text DEFAULT NULL,
  _bairro text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_cidade text;
  v_uf text;
  v_cep text;
  v_endereco text;
  v_bairro text;
  v_log text := '';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_old FROM public.lojas WHERE id = _loja_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  v_cidade := NULLIF(btrim(COALESCE(_cidade, '')), '');
  v_uf := NULLIF(upper(btrim(COALESCE(_uf, ''))), '');
  IF v_uf IS NOT NULL AND length(v_uf) <> 2 THEN
    RAISE EXCEPTION 'UF inválida';
  END IF;
  v_cep := NULLIF(regexp_replace(COALESCE(_cep, ''), '[^0-9]', '', 'g'), '');
  v_endereco := NULLIF(btrim(COALESCE(_endereco, '')), '');
  v_bairro := NULLIF(btrim(COALESCE(_bairro, '')), '');

  UPDATE public.lojas
  SET cidade = v_cidade,
      uf = v_uf,
      cep = COALESCE(v_cep, cep),
      endereco = COALESCE(v_endereco, endereco),
      bairro = COALESCE(v_bairro, bairro)
  WHERE id = _loja_id;

  IF COALESCE(v_old.cidade, '') <> COALESCE(v_cidade, '') THEN
    v_log := v_log || format('cidade: %s → %s ', COALESCE(v_old.cidade, '—'), COALESCE(v_cidade, '—'));
  END IF;
  IF COALESCE(v_old.uf, '') <> COALESCE(v_uf, '') THEN
    v_log := v_log || format('| uf: %s → %s ', COALESCE(v_old.uf, '—'), COALESCE(v_uf, '—'));
  END IF;
  IF v_cep IS NOT NULL AND COALESCE(v_old.cep, '') <> v_cep THEN
    v_log := v_log || format('| cep: %s → %s ', COALESCE(v_old.cep, '—'), v_cep);
  END IF;
  IF v_bairro IS NOT NULL AND COALESCE(v_old.bairro, '') <> v_bairro THEN
    v_log := v_log || format('| bairro: %s → %s ', COALESCE(v_old.bairro, '—'), v_bairro);
  END IF;
  IF v_endereco IS NOT NULL AND COALESCE(v_old.endereco, '') <> v_endereco THEN
    v_log := v_log || format('| endereço: %s → %s ', COALESCE(v_old.endereco, '—'), v_endereco);
  END IF;

  IF v_log <> '' AND v_old.user_id IS NOT NULL THEN
    INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
    VALUES (v_old.user_id, 'email', 'manual', format('Loja %s — %s', COALESCE(v_old.nome, '—'), v_log), auth.uid());
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text, text, text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_update_loja(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_get_cliente_detalhes(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT to_jsonb(t) INTO v FROM (
    SELECT
      p.user_id,
      p.nome,
      p.whatsapp,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      (SELECT count(*) FROM public.lojas l WHERE l.user_id = _user_id) AS total_lojas,
      (SELECT count(*) FROM public.fornecedores f WHERE f.user_id = _user_id) AS total_fornecedores,
      (SELECT count(*) FROM public.produtos pr WHERE pr.user_id = _user_id) AS total_produtos,
      (SELECT count(*) FROM public.cotacoes c WHERE c.created_by = _user_id) AS total_cotacoes,
      (SELECT max(c.created_at) FROM public.cotacoes c WHERE c.created_by = _user_id) AS ultima_cotacao_at,
      (SELECT to_jsonb(s) FROM (
        SELECT sub.status, sub.origem, sub.ciclo, sub.metodo_pagamento, sub.valor_pago,
               sub.current_period_start, sub.current_period_end, sub.canceled_at,
               pl.name AS plan_name, pl.display_name AS plan_display_name, pl.price_monthly
        FROM public.subscriptions sub
        JOIN public.plans pl ON pl.id = sub.plan_id
        WHERE sub.user_id = _user_id
        ORDER BY sub.created_at DESC
        LIMIT 1
      ) s) AS subscription,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', l.id,
          'nome', l.nome,
          'nome_fantasia', l.nome_fantasia,
          'cidade', l.cidade,
          'uf', l.uf,
          'cep', l.cep,
          'endereco', l.endereco,
          'bairro', l.bairro
        ) ORDER BY l.nome)
        FROM public.lojas l WHERE l.user_id = _user_id
      ), '[]'::jsonb) AS lojas
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id = _user_id
  ) t;

  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_cliente_detalhes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_cliente_detalhes(uuid) TO authenticated, service_role;