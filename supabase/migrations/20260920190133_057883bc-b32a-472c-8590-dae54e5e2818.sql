CREATE OR REPLACE FUNCTION public.admin_get_fornecedor_detalhes(_fornecedor_id uuid)
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
    'id', f.id,
    'nome', f.nome,
    'representante', f.representante,
    'telefone', f.telefone,
    'email', f.email,
    'pedido_minimo', f.pedido_minimo,
    'prazo_pagamento', f.prazo_pagamento,
    'observacoes', f.observacoes,
    'tipo_fornecedor', f.tipo_fornecedor,
    'pasta', COALESCE(to_jsonb(f.pasta), '[]'::jsonb),
    'cnpj', f.cnpj,
    'consentimento_rede', f.consentimento_rede,
    'consentimento_ultima_pergunta', f.consentimento_ultima_pergunta,
    'consentimento_tentativas_skip', f.consentimento_tentativas_skip,
    'consentimento_recusas', f.consentimento_recusas,
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