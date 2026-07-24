## Problema

Ao clicar em "Importar N itens" no modal `ImportErpModal`, o toast mostra "0 novos itens adicionados". A planilha de teste tem 5 itens com EAN que ainda **não existem** no cadastro local `produtos` do usuário.

## Causa raiz (confirmada no banco)

Em `src/components/ImportErpModal.tsx` (`doImport`), o insert em `produtos` é feito **sem** `user_id`:

```ts
supabase.from("produtos").insert(newProducts.map((p) => ({ nome: p.nome, embalagem: p.embalagem, ativo: true })))
```

A RLS de `produtos` exige `with_check: (user_id = auth.uid())`. Sem `user_id`, o insert é rejeitado. Como o código **ignora o `error`** do retorno, `inserted` fica `null`, o `existingMap` não recebe os novos produtos e o loop seguinte cai em `if (!prod) continue;` → nenhum `cotacao_produtos` é inserido → "0 novos itens".

Além disso, hoje o casamento é **só por nome** (case-insensitive). Como a planilha traz EAN, dá para casar direto com o catálogo global (`catalogo_mestre`) e evitar duplicar produtos no cadastro local.

## Correção

Em `src/components/ImportErpModal.tsx`, na função `doImport`:

1. **Buscar `auth.uid()` no início** e abortar com toast claro se não houver sessão.
2. **Casar por EAN primeiro (catálogo mestre)** para itens da planilha com EAN:
   - Consultar `catalogo_mestre` por `ean IN (...)`.
   - Para cada match, montar `cotacao_produtos` via `buildSnapshotInsert` com `fonte: "catalogo"` (não cria nada em `produtos`, respeita a arquitetura híbrida já existente).
3. **Para o restante (sem match no catálogo)**, casar por nome no `produtos` local (como hoje).
4. **Criar produtos locais faltantes** com `user_id: uid` no payload e **checar `error`** — se falhar, propagar via toast com a mensagem do Postgres (mesmo padrão usado em outros pontos do projeto).
5. **Montar inserts de `cotacao_produtos` via `buildSnapshotInsert`** (em vez do objeto manual atual), garantindo `nome`, `ean`, `tipo_embalagem` e `fator_embalagem` no snapshot — consistente com o resto do app.
6. **Checar `error` do insert em `cotacao_produtos`** e do update de quantidade, e refletir a contagem real no toast final.

## Testes

Adicionar em `src/components/ImportErpModal.test.tsx` (arquivo já existe) casos que verifiquem:
- Item com EAN presente em `catalogo_mestre` gera insert de `cotacao_produtos` com `catalogo_mestre_id` preenchido, sem criar linha em `produtos`.
- Item sem EAN / EAN não encontrado cria produto local **com `user_id` do usuário logado** e insere o `cotacao_produtos` correspondente.
- Sessão ausente → toast de erro, nenhum insert.
- Erro de RLS em `produtos.insert` é propagado (não silenciado).

## Fora de escopo

- Não alterar `startErpImport` (fluxo de criar cotação já funciona).
- Não mudar a UI do modal (preview, botão etc.).
- Não mexer em outras importações (NF, itens faltantes).