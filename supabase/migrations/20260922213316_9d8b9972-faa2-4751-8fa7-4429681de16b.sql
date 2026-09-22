-- 1) Políticas simples e sem recursão
DROP POLICY IF EXISTS "Users see own fornecedores" ON public.fornecedores;
CREATE POLICY "Users see own fornecedores"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own fornecedor_lojas" ON public.fornecedor_lojas;
CREATE POLICY "Users manage own fornecedor_lojas"
ON public.fornecedor_lojas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = fornecedor_lojas.loja_id
      AND l.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = fornecedor_lojas.loja_id
      AND l.user_id = auth.uid()
  )
);

-- 2) Unificação só dentro do mesmo dono (ou cadastros sem dono / da Rede)
CREATE OR REPLACE FUNCTION public.admin_unificar_valida_dono(_mestre_id uuid, _sobressalente_ids uuid[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dono_mestre uuid;
  _conflito int;
BEGIN
  SELECT user_id INTO _dono_mestre FROM public.fornecedores WHERE id = _mestre_id;

  SELECT count(*) INTO _conflito
  FROM public.fornecedores f
  WHERE f.id = ANY(_sobressalente_ids)
    AND f.user_id IS NOT NULL
    AND _dono_mestre IS NOT NULL
    AND f.user_id <> _dono_mestre;

  IF _conflito > 0 THEN
    RAISE EXCEPTION 'Não é possível unificar cadastros de clientes diferentes. Unifique apenas cadastros do mesmo cliente ou cadastros da Rede sem dono.';
  END IF;
END;
$$;
