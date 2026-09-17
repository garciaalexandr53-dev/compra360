CREATE OR REPLACE FUNCTION public.validar_item_faltante_publico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recentes integer;
BEGIN
  -- Aplica-se apenas a inserções sem usuário autenticado (app público de funcionários)
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.nome := btrim(NEW.nome);
  IF NEW.nome IS NULL OR length(NEW.nome) = 0 OR length(NEW.nome) > 200 THEN
    RAISE EXCEPTION 'Nome do item inválido';
  END IF;

  IF NEW.observacao IS NOT NULL AND length(NEW.observacao) > 500 THEN
    RAISE EXCEPTION 'Observação muito longa';
  END IF;

  IF NEW.registrado_por IS NOT NULL AND length(NEW.registrado_por) > 100 THEN
    RAISE EXCEPTION 'Nome de quem registrou muito longo';
  END IF;

  IF NEW.ean IS NOT NULL AND NEW.ean !~ '^[0-9]{8,14}$' THEN
    RAISE EXCEPTION 'EAN inválido';
  END IF;

  IF NEW.quantidade IS NOT NULL AND (NEW.quantidade < 1 OR NEW.quantidade > 9999) THEN
    RAISE EXCEPTION 'Quantidade fora do intervalo permitido';
  END IF;

  IF NEW.fator_embalagem IS NOT NULL AND (NEW.fator_embalagem < 1 OR NEW.fator_embalagem > 1000) THEN
    RAISE EXCEPTION 'Fator de embalagem fora do intervalo permitido';
  END IF;

  -- Limite anti-abuso por loja: no máximo 300 registros públicos por hora
  SELECT count(*) INTO recentes
  FROM public.itens_faltantes
  WHERE loja_id = NEW.loja_id
    AND created_at > now() - interval '1 hour';

  IF recentes >= 300 THEN
    RAISE EXCEPTION 'Muitos registros enviados para esta loja. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_item_faltante_publico ON public.itens_faltantes;
CREATE TRIGGER trg_validar_item_faltante_publico
BEFORE INSERT ON public.itens_faltantes
FOR EACH ROW EXECUTE FUNCTION public.validar_item_faltante_publico();

REVOKE EXECUTE ON FUNCTION public.validar_item_faltante_publico() FROM anon, authenticated;