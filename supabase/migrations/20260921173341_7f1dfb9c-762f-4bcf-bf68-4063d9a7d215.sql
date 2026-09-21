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

  WITH novos AS (
    INSERT INTO public.fornecedores (
      nome, representante, telefone, email, pedido_minimo, prazo_pagamento,
      observacoes, tipo_fornecedor, pasta, user_id, token
    )
    SELECT f.nome, f.representante, f.telefone, f.email, f.pedido_minimo, f.prazo_pagamento,
           f.observacoes, f.tipo_fornecedor, f.pasta, _uid,
           replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
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
$function$;

REVOKE EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copiar_fornecedores_para_loja(uuid, uuid[]) TO service_role;