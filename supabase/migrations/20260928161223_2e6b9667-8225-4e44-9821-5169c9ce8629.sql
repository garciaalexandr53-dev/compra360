CREATE OR REPLACE FUNCTION public.validar_item_faltante_publico()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  recentes integer;
BEGIN
  -- Normaliza o EAN para todos: aceita 4 a 14 digitos, descarta o resto sem barrar
  IF NEW.ean IS NOT NULL THEN
    NEW.ean := NULLIF(regexp_replace(NEW.ean, '\s', '', 'g'), '');
    IF NEW.ean IS NOT NULL AND NEW.ean !~ '^[0-9]{4,14}$' THEN
      NEW.ean := NULL;
    END IF;
  END IF;

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
  IF NEW.quantidade IS NOT NULL AND (NEW.quantidade < 1 OR NEW.quantidade > 9999) THEN
    RAISE EXCEPTION 'Quantidade fora do intervalo permitido';
  END IF;
  IF NEW.fator_embalagem IS NOT NULL AND (NEW.fator_embalagem < 1 OR NEW.fator_embalagem > 1000) THEN
    RAISE EXCEPTION 'Fator de embalagem fora do intervalo permitido';
  END IF;

  SELECT count(*) INTO recentes FROM public.itens_faltantes
  WHERE loja_id = NEW.loja_id AND created_at > now() - interval '1 hour';
  IF recentes >= 300 THEN
    RAISE EXCEPTION 'Muitos registros enviados para esta loja. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END;
$function$;