## Objetivo
Descobrir e corrigir a causa real do "Erro ao desfazer" que ocorre APENAS para itens do Catálogo Mestre (itens locais já voltam corretos).

## Diagnóstico até aqui

O que já foi verificado:

- **Snapshot está correto**: a query `cotacao_produtos.select("*, produtos(...)")` retorna todos os campos, incluindo `catalogo_mestre_id`, `nome`, `ean`, `fator_embalagem` etc. — confirmado no network log (`{"id":"f220621a…","catalogo_mestre_id":"0a0ee81b…","nome":"Abacaxi em Calda…"}`).
- **`buildUndoInsert`** copia o snapshot fielmente, sem fallback.
- **Constraints da tabela** `cotacao_produtos`:
  - `CHECK (produto_id IS NOT NULL OR catalogo_mestre_id IS NOT NULL)` — atendido (catalogo_mestre_id preenchido).
  - `UNIQUE (cotacao_id, produto_id)` — NULLs são distintos por padrão no Postgres, então não conflita.
  - `nome NOT NULL`, `fator_embalagem NOT NULL` — ambos preenchidos no snapshot.
- **RLS** `Users manage own cotacao_produtos` — valida via `cotacoes.created_by = auth.uid()`, condição satisfeita.
- O erro `400 invalid input syntax for type uuid: "null"` visto no log **NÃO é** do undo — é de uma consulta separada de reposição (`cotacao_produtos?produto_id=in.(...,null)`), sem relação com este bug.

Ou seja: o payload aparenta estar 100% válido, mas o insert ainda falha em runtime. O código atual joga fora a mensagem real do erro (`toast.error("Erro ao desfazer")` sem `cpErr.message`), o que impede o diagnóstico final.

## Passo 1 — Expor a mensagem real (chave para o diagnóstico)

Em `src/pages/CotacaoPage.tsx` (linha ~361), trocar:

```ts
if (cpErr) { toast.error("Erro ao desfazer"); return; }
```

por:

```ts
if (cpErr) {
  console.error("[undo cotacao_produto] insert falhou", { payload, cpErr });
  toast.error(`Erro ao desfazer: ${cpErr.message}`);
  return;
}
```

Isso mostra no toast a mensagem do Postgres (`code`, `details`, `hint`) e imprime o payload no console. Com isso conseguimos ver qual constraint / policy / coluna está reclamando.

## Passo 2 — Reproduzir e ler a mensagem

O usuário adiciona um item do Catálogo Mestre → exclui → clica em **Desfazer**. O toast agora exibe a mensagem real (ex.: `duplicate key value violates unique constraint …`, `null value in column …`, `new row violates row-level security`, etc.).

## Passo 3 — Aplicar o fix específico

Com a mensagem em mãos, o fix é direto. As hipóteses mais prováveis, com o remédio de cada uma:

- **`duplicate key … cotacao_produtos_pkey`** → outro insert (realtime/optimistic) reinseriu o id antes de nós; solução: no undo, gerar novo id em vez de reaproveitar (`id: crypto.randomUUID()`) e ajustar `saved.precos` para apontar para o novo id.
- **`null value in column "fator_embalagem"`** → snapshot vindo com null; garantir `fator_embalagem: cp.fator_embalagem ?? 1` na captura (mantendo `nome` sem fallback, conforme sua regra).
- **`new row violates row-level security`** → cotação já foi encerrada/movida entre a exclusão e o clique; tratar com mensagem clara ("Cotação não está mais ativa").
- **Outro** → fix pontual conforme a mensagem.

Sem inventar solução às cegas: o passo 1 é o que destrava a decisão.

## Escopo

- Único arquivo alterado no passo 1: `src/pages/CotacaoPage.tsx` (uma linha).
- Passo 3 pode alterar `src/pages/CotacaoPage.tsx` e/ou `src/lib/undoCotacaoProduto.ts` conforme o erro. Sem migração. Sem mexer em outros inserts. Sem mudança de UI além da mensagem do toast.

## Fora de escopo

- O 400 de `produto_id=in.(...,null)` é outro bug (consulta de reposição). Pode ser tratado depois em ticket separado.
