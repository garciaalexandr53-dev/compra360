CREATE OR REPLACE FUNCTION public.get_lojas_public(_loja_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _loja_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT l.id, l.nome FROM public.lojas l WHERE l.id = _loja_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pedidos_conferencia_publico(_loja_id uuid)
 RETURNS TABLE(id uuid, numero integer, total numeric, created_at timestamp with time zone, fornecedor_id uuid, fornecedor_nome text, loja_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _loja_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, p.numero, p.total, p.created_at, p.fornecedor_id, f.nome::text, p.loja_id
    FROM public.pedidos p
    LEFT JOIN public.fornecedores f ON f.id = p.fornecedor_id
    WHERE p.loja_id = _loja_id
      AND p.status = 'enviado'::pedido_status
    ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pedido_itens_publico(_loja_id uuid, _pedido_id uuid)
 RETURNS TABLE(cotacao_produto_id uuid, produto_nome text, embalagem text, fator_embalagem integer, quantidade numeric, preco numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cotacao_id uuid;
  _fornecedor_id uuid;
BEGIN
  IF _loja_id IS NULL OR _pedido_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.cotacao_id, p.fornecedor_id
    INTO _cotacao_id, _fornecedor_id
  FROM public.pedidos p
  WHERE p.id = _pedido_id
    AND p.loja_id = _loja_id
    AND p.status = 'enviado'::pedido_status;

  IF _cotacao_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT cp.id,
           cp.nome,
           COALESCE(cp.tipo_embalagem, pr.embalagem),
           cp.fator_embalagem,
           cp.quantidade,
           px.preco
    FROM public.cotacao_produtos cp
    LEFT JOIN public.produtos pr ON pr.id = cp.produto_id
    JOIN public.precos px ON px.cotacao_produto_id = cp.id AND px.fornecedor_id = _fornecedor_id
    WHERE cp.cotacao_id = _cotacao_id
      AND px.preco IS NOT NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pedidos_conferencia_publico(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pedido_itens_publico(uuid, uuid) TO anon, authenticated;