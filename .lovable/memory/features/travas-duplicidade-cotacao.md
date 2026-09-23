---
name: Travas anti-duplicidade em cotações
description: Duas travas cumulativas (IDs técnicos + nome normalizado) impedem o mesmo produto duas vezes na cotação
type: feature
---

Um produto pode chegar à cotação por duas origens: cadastro local da loja (`produto_id`)
ou Catálogo Mestre (`catalogo_mestre_id`). Como os ids são diferentes, a trava original
deixava passar duplicatas (caso real: "Sal Grosso para Churrasco Uniao 1kg", 3 FD + 4 FD).

Regra definitiva — as DUAS travas ficam ativas, nunca substituir uma pela outra:
1. Trava 1: comparação por `produto_id` / `catalogo_mestre_id` (comportamento antigo).
2. Trava 2: comparação por nome normalizado (`normalizeNomeCotacao`: NFD sem acentos,
   minúsculo, não-alfanuméricos viram espaço, espaços colapsados).

Helper único: `src/lib/cotacaoDedup.ts` (`normalizeNomeCotacao`, `buildNomeIndex`,
`isDuplicadoNaCotacao`). Testes em `src/lib/cotacaoDedup.test.ts`.

Aplicado nas três entradas de itens na cotação:
- `src/pages/AddProdutosCotacaoPage.tsx` — bloqueia no diálogo (toast "Este produto já está
  na cotação. Ajuste a quantidade na tela da cotação.") e novamente no insert.
- `src/pages/ProdutosPage.tsx` — mutation lança `DUPLICADO_NA_COTACAO`, traduzido no onError.
- `src/components/ImportErpModal.tsx` — `cpsByNome` faz o item existente receber UPDATE de
  quantidade em vez de novo insert; `nomesPlanejados` deduplica dentro do próprio lote.
