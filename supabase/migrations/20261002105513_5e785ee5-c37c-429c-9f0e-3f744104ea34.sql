CREATE OR REPLACE FUNCTION public.get_pedido_itens_publico(_loja_id uuid, _pedido_id uuid)
 RETURNS TABLE(cotacao_produto_id uuid, produto_nome text, embalagem text, fator_embalagem integer, quantidade numeric, preco numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cotacao_id uuid;
  _fornecedor_id uuid;
  _itens jsonb;
BEGIN
  IF _loja_id IS NULL OR _pedido_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.cotacao_id, p.fornecedor_id, p.itens
    INTO _cotacao_id, _fornecedor_id, _itens
  FROM public.pedidos p
  WHERE p.id = _pedido_id
    AND p.loja_id = _loja_id
    AND p.status = 'enviado'::pedido_status;

  IF _cotacao_id IS NULL THEN
    RETURN;
  END IF;

  IF _itens IS NOT NULL AND jsonb_typeof(_itens) = 'array' AND jsonb_array_length(_itens) > 0 THEN
    RETURN QUERY
      SELECT NULLIF(e->>'cotacao_produto_id','')::uuid,
             COALESCE(e->>'produto','Produto'),
             COALESCE(e->>'embalagem','UNI'),
             GREATEST(COALESCE((e->>'fator')::numeric,1),1)::integer,
             COALESCE((e->>'quantidade')::numeric,1),
             COALESCE((e->>'preco')::numeric,0)
      FROM jsonb_array_elements(_itens) e;
    RETURN;
  END IF;

  -- Pedido antigo sem lista gravada: só itens que este fornecedor venceu (menor preço).
  RETURN QUERY
    SELECT cp.id, cp.nome, COALESCE(cp.tipo_embalagem, pr.embalagem), cp.fator_embalagem, cp.quantidade, px.preco
    FROM public.cotacao_produtos cp
    LEFT JOIN public.produtos pr ON pr.id = cp.produto_id
    JOIN public.precos px ON px.cotacao_produto_id = cp.id AND px.fornecedor_id = _fornecedor_id
    WHERE cp.cotacao_id = _cotacao_id
      AND px.preco > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.precos o
        WHERE o.cotacao_produto_id = cp.id AND o.fornecedor_id <> _fornecedor_id
          AND o.preco > 0 AND o.preco < px.preco
      );
END;
$function$;