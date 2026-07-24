## Problema

Ao clicar em "Importar do ERP" no Dashboard, o insert em `cotacoes` falha com:
`new row violates row-level security policy for table "cotacoes"`

Causa: em `src/pages/DashboardPage.tsx` (linha ~588), o `insertCotacao` passado ao helper `startErpImport` insere apenas `{ loja_id, status, nome }`. A política de RLS de `cotacoes` exige `created_by = auth.uid()` (o insert manual da mesma página, na linha 433, já preenche esse campo corretamente).

## Correção

1. `src/pages/DashboardPage.tsx` — no callback `insertCotacao`, obter o usuário autenticado (`supabase.auth.getUser()`) e incluir `created_by: user.id` no payload enviado ao `.insert(...)`. Manter o contrato do helper: `startErpImport` continua chamando `insertCotacao(payload)` com `{loja_id, status, nome}` e a page enriquece com `created_by` antes de bater no banco. Se `getUser()` não retornar usuário, retornar `null` para o helper sinalizar `insert-failed`.

2. `src/lib/startErpImport.test.ts` — nenhum ajuste necessário: o teste injeta `insertCotacao` como mock, então o contrato do helper permanece.

3. Verificação: rodar os testes existentes (`startErpImport.test.ts`) e validar manualmente que "Importar do ERP" cria a cotação e abre o modal.

## Fora de escopo

Não mexer em políticas RLS, migrations ou no helper `startErpImport` (que é puro e não deve conhecer `auth`).
