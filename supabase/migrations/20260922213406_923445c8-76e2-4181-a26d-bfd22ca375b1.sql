DROP FUNCTION IF EXISTS public.admin_unificar_valida_dono(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.admin_unificar_fornecedor(_mestre_id uuid, _sobressalente_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sobr uuid;
  _movidos bigint := 0;
  _removidos int := 0;
  _n bigint;
  _dono_mestre uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF _mestre_id IS NULL THEN
    RAISE EXCEPTION 'Informe o cadastro principal (mestre).';
  END IF;

  IF _sobressalente_ids IS NULL OR array_length(_sobressalente_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um cadastro a unificar.';
  END IF;

  SELECT user_id INTO _dono_mestre FROM public.fornecedores WHERE id = _mestre_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro principal não encontrado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fornecedores f
    WHERE f.id = ANY(_sobressalente_ids)
      AND f.user_id IS NOT NULL
      AND _dono_mestre IS NOT NULL
      AND f.user_id <> _dono_mestre
  ) THEN
    RAISE EXCEPTION 'Não é possível unificar cadastros de clientes diferentes. Unifique apenas cadastros do mesmo cliente ou cadastros da Rede sem dono.';
  END IF;

  FOREACH _sobr IN ARRAY _sobressalente_ids
  LOOP
    IF _sobr = _mestre_id THEN
      RAISE EXCEPTION 'O cadastro principal não pode ser unificado a si mesmo.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = _sobr) THEN
      CONTINUE;
    END IF;

    UPDATE public.fornecedores m
    SET
      telefone = COALESCE(m.telefone, s.telefone),
      email = COALESCE(m.email, s.email),
      representante = COALESCE(m.representante, s.representante),
      observacoes = COALESCE(NULLIF(btrim(m.observacoes), ''), s.observacoes),
      pedido_minimo = COALESCE(NULLIF(m.pedido_minimo, 0), s.pedido_minimo),
      prazo_pagamento = COALESCE(NULLIF(btrim(m.prazo_pagamento), ''), s.prazo_pagamento),
      tipo_fornecedor = COALESCE(NULLIF(btrim(m.tipo_fornecedor), ''), s.tipo_fornecedor),
      cnpj = COALESCE(NULLIF(btrim(m.cnpj), ''), s.cnpj),
      pasta = CASE WHEN m.pasta IS NULL OR array_length(m.pasta, 1) IS NULL THEN s.pasta ELSE m.pasta END,
      consentimento_rede = CASE
        WHEN m.consentimento_rede = 'sim' THEN 'sim'
        WHEN s.consentimento_rede = 'sim' THEN 'sim'
        ELSE m.consentimento_rede END,
      user_id = COALESCE(m.user_id, s.user_id),
      updated_at = now()
    FROM (SELECT * FROM public.fornecedores WHERE id = _sobr) s
    WHERE m.id = _mestre_id;

    WITH mov AS (
      UPDATE public.fornecedor_lojas fl
      SET fornecedor_id = _mestre_id
      WHERE fl.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.fornecedor_lojas fl2
        WHERE fl2.fornecedor_id = _mestre_id AND fl2.loja_id = fl.loja_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.fornecedor_cidades_atendidas cc
      SET fornecedor_id = _mestre_id
      WHERE cc.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.fornecedor_cidades_atendidas cc2
        WHERE cc2.fornecedor_id = _mestre_id
          AND cc2.cidade_norm = cc.cidade_norm
          AND COALESCE(cc2.uf, '') = COALESCE(cc.uf, '')
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.cotacao_fornecedores cf
      SET fornecedor_id = _mestre_id
      WHERE cf.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.cotacao_fornecedores cf2
        WHERE cf2.fornecedor_id = _mestre_id AND cf2.cotacao_id = cf.cotacao_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.precos pc
      SET fornecedor_id = _mestre_id
      WHERE pc.fornecedor_id = _sobr
      AND NOT EXISTS (
        SELECT 1 FROM public.precos pc2
        WHERE pc2.fornecedor_id = _mestre_id AND pc2.cotacao_produto_id = pc.cotacao_produto_id
      )
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.pedidos pd
      SET fornecedor_id = _mestre_id
      WHERE pd.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.historico_envios he
      SET fornecedor_id = _mestre_id
      WHERE he.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    WITH mov AS (
      UPDATE public.fornecedor_acessos fa
      SET fornecedor_id = _mestre_id
      WHERE fa.fornecedor_id = _sobr
      RETURNING 1
    )
    SELECT COUNT(*)::bigint INTO _n FROM mov;
    _movidos := _movidos + _n;

    DELETE FROM public.fornecedores WHERE id = _sobr;
    _removidos := _removidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'mestre_id', _mestre_id,
    'unificados', _removidos,
    'relacionamentos_movidos', _movidos
  );
END;
$function$;
