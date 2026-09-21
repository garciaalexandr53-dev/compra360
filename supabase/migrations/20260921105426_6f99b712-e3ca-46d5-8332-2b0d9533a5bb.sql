ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS numero text;

CREATE OR REPLACE FUNCTION public.admin_update_loja(
  _loja_id uuid,
  _cidade text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _cep text DEFAULT NULL,
  _endereco text DEFAULT NULL,
  _bairro text DEFAULT NULL,
  _numero text DEFAULT NULL
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
  v_numero text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT * INTO v_old FROM public.lojas WHERE id = _loja_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'loja not found';
  END IF;

  v_cidade := NULLIF(btrim(coalesce(_cidade, '')), '');
  v_uf := NULLIF(upper(btrim(coalesce(_uf, ''))), '');
  IF v_uf IS NOT NULL AND length(v_uf) <> 2 THEN
    v_uf := NULL;
  END IF;
  v_cep := NULLIF(regexp_replace(coalesce(_cep, ''), '[^0-9]', '', 'g'), '');
  v_endereco := NULLIF(btrim(coalesce(_endereco, '')), '');
  v_bairro := NULLIF(btrim(coalesce(_bairro, '')), '');
  v_numero := NULLIF(btrim(coalesce(_numero, '')), '');

  UPDATE public.lojas
     SET cidade = v_cidade,
         uf = v_uf,
         cep = v_cep,
         endereco = v_endereco,
         bairro = v_bairro,
         numero = v_numero
   WHERE id = _loja_id;

  IF coalesce(v_old.cidade, '') IS DISTINCT FROM coalesce(v_cidade, '')
     OR coalesce(v_old.uf, '') IS DISTINCT FROM coalesce(v_uf, '')
     OR coalesce(v_old.cep, '') IS DISTINCT FROM coalesce(v_cep, '')
     OR coalesce(v_old.endereco, '') IS DISTINCT FROM coalesce(v_endereco, '')
     OR coalesce(v_old.bairro, '') IS DISTINCT FROM coalesce(v_bairro, '')
     OR coalesce(v_old.numero, '') IS DISTINCT FROM coalesce(v_numero, '')
  THEN
    IF v_old.user_id IS NOT NULL THEN
      INSERT INTO public.admin_contatos (user_id, canal, motivo, observacao, admin_id)
      VALUES (
        v_old.user_id,
        'email',
        'manual',
        'Endereço da loja "' || v_old.nome || '" atualizado pelo admin: '
          || coalesce(v_old.cep, '-') || ' → ' || coalesce(v_cep, '-') || ' | '
          || coalesce(v_old.endereco, '-') || ' → ' || coalesce(v_endereco, '-') || ' | nº '
          || coalesce(v_old.numero, '-') || ' → ' || coalesce(v_numero, '-') || ' | '
          || coalesce(v_old.bairro, '-') || ' → ' || coalesce(v_bairro, '-') || ' | '
          || coalesce(v_old.cidade, '-') || '/' || coalesce(v_old.uf, '-')
          || ' → ' || coalesce(v_cidade, '-') || '/' || coalesce(v_uf, '-'),
        auth.uid()
      );
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_loja(uuid, text, text, text, text, text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_update_loja(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_get_cliente_detalhes(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT to_jsonb(base) INTO v_result
  FROM (
    SELECT
      u.id AS user_id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      p.nome,
      p.whatsapp,
      (SELECT jsonb_build_object(
                'plano', pl.display_name,
                'status', s.status,
                'origem', s.origem,
                'ciclo', s.ciclo,
                'valor_pago', s.valor_pago,
                'current_period_end', s.current_period_end,
                'metodo_pagamento', s.metodo_pagamento
              )
         FROM public.subscriptions s
         JOIN public.plans pl ON pl.id = s.plan_id
        WHERE s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1) AS assinatura,
      (SELECT count(*) FROM public.lojas l WHERE l.user_id = u.id) AS total_lojas,
      (SELECT count(*) FROM public.produtos pr WHERE pr.user_id = u.id) AS total_produtos,
      (SELECT count(*) FROM public.fornecedores f WHERE f.user_id = u.id) AS total_fornecedores,
      (SELECT count(*) FROM public.cotacoes c WHERE c.created_by = u.id) AS total_cotacoes,
      (SELECT max(c.created_at) FROM public.cotacoes c WHERE c.created_by = u.id) AS ultima_cotacao,
      (SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id,
                'nome', l.nome,
                'nome_fantasia', l.nome_fantasia,
                'cidade', l.cidade,
                'uf', l.uf,
                'cep', l.cep,
                'endereco', l.endereco,
                'numero', l.numero,
                'bairro', l.bairro
              ) ORDER BY l.created_at), '[]'::jsonb)
         FROM public.lojas l WHERE l.user_id = u.id) AS lojas
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.id = _user_id
  ) base;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_cliente_detalhes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_cliente_detalhes(uuid) TO authenticated, service_role;