
-- 1) Trigger backstop: preenche nome/ean quando o caller esqueceu
CREATE OR REPLACE FUNCTION public.cotacao_produtos_fill_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS NULL OR btrim(NEW.nome) = '' THEN
    IF NEW.catalogo_mestre_id IS NOT NULL THEN
      SELECT cm.nome, cm.ean
        INTO NEW.nome, NEW.ean
      FROM public.catalogo_mestre cm
      WHERE cm.id = NEW.catalogo_mestre_id;
    ELSIF NEW.produto_id IS NOT NULL THEN
      SELECT p.nome
        INTO NEW.nome
      FROM public.produtos p
      WHERE p.id = NEW.produto_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacao_produtos_fill_snapshot ON public.cotacao_produtos;
CREATE TRIGGER trg_cotacao_produtos_fill_snapshot
BEFORE INSERT OR UPDATE ON public.cotacao_produtos
FOR EACH ROW
EXECUTE FUNCTION public.cotacao_produtos_fill_snapshot();

-- 2) Recuperação: reprocessa itens_faltantes marcados importado=true
-- nas últimas 3h cuja cotação ativa da mesma loja está vazia
INSERT INTO public.cotacao_produtos
  (cotacao_id, produto_id, catalogo_mestre_id, nome, ean, quantidade, tipo_embalagem, fator_embalagem)
SELECT
  c.id                                                                       AS cotacao_id,
  p.id                                                                       AS produto_id,
  NULL::uuid                                                                 AS catalogo_mestre_id,
  p.nome                                                                     AS nome,
  NULL::text                                                                 AS ean,
  COALESCE(i.quantidade, 1)                                                  AS quantidade,
  UPPER(COALESCE(NULLIF(btrim(i.embalagem), ''), p.embalagem, 'UNI'))        AS tipo_embalagem,
  COALESCE(NULLIF(i.fator_embalagem, 0), p.fator_embalagem, 1)::int          AS fator_embalagem
FROM public.itens_faltantes i
JOIN public.cotacoes c
  ON c.status = 'ativa' AND c.loja_id = i.loja_id
JOIN public.produtos p
  ON p.user_id = c.created_by AND lower(p.nome) = lower(i.nome)
WHERE i.importado = true
  AND i.catalogo_mestre_id IS NULL
  AND i.created_at > now() - interval '3 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.cotacao_produtos cp
    WHERE cp.cotacao_id = c.id AND cp.produto_id = p.id
  );

-- 2b) Recupera itens do catálogo mestre também
INSERT INTO public.cotacao_produtos
  (cotacao_id, produto_id, catalogo_mestre_id, nome, ean, quantidade, tipo_embalagem, fator_embalagem)
SELECT
  c.id                                                                       AS cotacao_id,
  NULL::uuid                                                                 AS produto_id,
  i.catalogo_mestre_id                                                       AS catalogo_mestre_id,
  COALESCE(i.nome, cm.nome)                                                  AS nome,
  COALESCE(i.ean, cm.ean)                                                    AS ean,
  COALESCE(i.quantidade, 1)                                                  AS quantidade,
  UPPER(COALESCE(NULLIF(btrim(i.embalagem), ''), cm.embalagem, 'UNI'))       AS tipo_embalagem,
  COALESCE(NULLIF(i.fator_embalagem, 0), cm.fator_embalagem, 1)::int         AS fator_embalagem
FROM public.itens_faltantes i
JOIN public.cotacoes c
  ON c.status = 'ativa' AND c.loja_id = i.loja_id
JOIN public.catalogo_mestre cm
  ON cm.id = i.catalogo_mestre_id
WHERE i.importado = true
  AND i.catalogo_mestre_id IS NOT NULL
  AND i.created_at > now() - interval '3 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.cotacao_produtos cp
    WHERE cp.cotacao_id = c.id AND cp.catalogo_mestre_id = i.catalogo_mestre_id
  );
