## Fix: "Desfazer exclusão" reinsere item sem `nome` (viola NOT NULL)

### Problema
Em `src/pages/CotacaoPage.tsx`, o `deleteCpMutation` guarda apenas `{ cpId, produto_id, cotacao_id, quantidade, precos }` em `lastDeletedRef` (linhas 317, 325‑331). No "Desfazer" (linha 346), reinsere só esses campos. Como `cotacao_produtos.nome` é NOT NULL — e o item pode ser do catálogo (`catalogo_mestre_id`, sem `produto_id`) — o insert falha e o toast mostra "Erro ao desfazer".

### Correção

**1. `src/pages/CotacaoPage.tsx`**
- Expandir o tipo de `lastDeletedRef` para preservar o snapshot completo:
  `{ cpId, cotacao_id, produto_id, catalogo_mestre_id, nome, ean, tipo_embalagem, fator_embalagem, quantidade, precos }`.
- No `mutationFn`, ao encontrar `cp`, copiar todos esses campos do `cotacaoProdutos` original (já vêm do `select` da query).
- No handler "Desfazer", montar o payload de insert reaproveitando o snapshot salvo via `buildUndoInsert` (nova função pura) — mantendo `id: saved.cpId`, `nome` copiado diretamente do snapshot (SEM fallback), `ean`, `catalogo_mestre_id` OU `produto_id`, `tipo_embalagem`, `fator_embalagem`, `quantidade`, `cotacao_id`.
- **Sem fallback para `nome`**: se o snapshot vier sem nome, o insert vai falhar contra o NOT NULL e o toast de erro aparece — comportamento desejado, erro visível ao invés de dado mascarado.
- Não alterar nenhum outro insert em `cotacao_produtos`. Não usar `buildSnapshotInsert` porque foi desenhado para `ProdutoHibrido` da busca — aqui reaproveitar o snapshot original é mais fiel.

**2. Nova função pura — `src/lib/undoCotacaoProduto.ts`**
- Export `buildUndoInsert(saved)` que recebe o snapshot salvo e retorna o objeto pronto para `supabase.from("cotacao_produtos").insert(...)`. Sem lógica de fallback. Copia `nome` diretamente.

**3. Teste — `src/lib/undoCotacaoProduto.test.ts`**
- Caso 1 (item de catálogo): snapshot com `nome`, `ean`, `catalogo_mestre_id`, `produto_id: null` → payload preserva `nome` real, `catalogo_mestre_id` presente, `produto_id: null`.
- Caso 2 (item local): snapshot com `produto_id`, `catalogo_mestre_id: null`, `nome` real → payload preserva `nome` real, `produto_id` presente, `catalogo_mestre_id: null`.
- Ambos os testes assertam `expect(payload.nome).toBe(<nome exato do snapshot>)`.
- **Sem teste de fallback "—"** — esse caminho não existe.

### Fora de escopo
- Não mexer nos outros 9 inserts auditados em `cotacao_produtos`.
- Sem mudança de UI/responsivo.
- Sem migração de banco.

### Arquivos
```
src/pages/CotacaoPage.tsx                 (expandir ref + usar buildUndoInsert)
src/lib/undoCotacaoProduto.ts             (nova função pura)
src/lib/undoCotacaoProduto.test.ts        (2 casos: catálogo e local)
```

Posso executar?
