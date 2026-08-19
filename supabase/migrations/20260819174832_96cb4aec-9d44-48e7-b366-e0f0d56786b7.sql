DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH cp AS (
      SELECT cp.id, cp.cotacao_id, cp.quantidade,
        COALESCE('cat:'||cp.catalogo_mestre_id, 'ean:'||NULLIF(trim(cp.ean),''), 'prod:'||cp.produto_id, 'nome:'||lower(trim(cp.nome))) AS chave,
        (SELECT count(*) FROM precos p WHERE p.cotacao_produto_id = cp.id AND p.preco IS NOT NULL) AS precos_ct
      FROM cotacao_produtos cp
      JOIN cotacoes c ON c.id = cp.cotacao_id
      WHERE c.status = 'ativa'
    ), ranked AS (
      SELECT *, row_number() OVER (PARTITION BY cotacao_id, chave ORDER BY precos_ct DESC, id) AS rn,
             max(quantidade) OVER (PARTITION BY cotacao_id, chave) AS qtd_max,
             count(*) OVER (PARTITION BY cotacao_id, chave) AS grupo_ct
      FROM cp
    )
    SELECT cotacao_id, chave, qtd_max,
           (array_agg(id ORDER BY rn))[1] AS keep_id,
           array_remove(array_agg(CASE WHEN rn > 1 THEN id END), NULL) AS drop_ids
    FROM ranked
    WHERE grupo_ct > 1
    GROUP BY cotacao_id, chave, qtd_max
  LOOP
    DELETE FROM precos WHERE cotacao_produto_id = ANY(r.drop_ids);
    DELETE FROM cotacao_produtos WHERE id = ANY(r.drop_ids);
    UPDATE cotacao_produtos SET quantidade = r.qtd_max WHERE id = r.keep_id;
  END LOOP;
END $$;