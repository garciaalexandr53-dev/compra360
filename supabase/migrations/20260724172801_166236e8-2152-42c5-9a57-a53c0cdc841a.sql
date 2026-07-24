CREATE OR REPLACE FUNCTION public.get_itens_enviados_publico(_loja_id uuid, _since timestamptz)
RETURNS TABLE (
  id uuid,
  nome text,
  quantidade numeric,
  observacao text,
  registrado_por text,
  created_at timestamptz,
  importado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.nome, i.quantidade, i.observacao, i.registrado_por, i.created_at, i.importado
  FROM public.itens_faltantes i
  WHERE i.loja_id = _loja_id
    AND i.created_at >= _since
    AND EXISTS (SELECT 1 FROM public.lojas l WHERE l.id = _loja_id)
  ORDER BY i.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_itens_enviados_publico(uuid, timestamptz) TO anon, authenticated;