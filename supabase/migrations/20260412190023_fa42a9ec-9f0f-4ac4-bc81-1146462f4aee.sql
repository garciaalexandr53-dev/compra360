-- Drop the overly broad anon policy
DROP POLICY IF EXISTS "Anon read produtos by loja owner" ON public.produtos;

-- Create a scoped SECURITY DEFINER function for App Funcionários
CREATE OR REPLACE FUNCTION public.get_produtos_for_loja(
  _loja_id uuid,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 80,
  _offset integer DEFAULT 0
)
RETURNS TABLE(nome text, embalagem text, fator_embalagem integer, categoria_nome text, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  -- Get the loja owner
  SELECT l.user_id INTO _owner_id FROM public.lojas l WHERE l.id = _loja_id;
  IF _owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.nome,
    p.embalagem,
    p.fator_embalagem,
    c.nome AS categoria_nome,
    COUNT(*) OVER() AS total_count
  FROM public.produtos p
  LEFT JOIN public.categorias c ON c.id = p.categoria_id
  WHERE p.user_id = _owner_id
    AND p.ativo = true
    AND (_search IS NULL OR p.nome ILIKE '%' || _search || '%')
  ORDER BY p.nome
  LIMIT _limit
  OFFSET _offset;
END;
$$;