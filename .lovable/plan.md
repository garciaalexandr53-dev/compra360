## Diagnóstico

A rede confirma que o navegador rodou uma versão **antiga** do `ImportErpModal`:

- `POST /rest/v1/produtos?columns=%22nome%22%2C%22embalagem%22%2C%22ativo%22` — o payload não inclui `user_id` (por isso RLS retorna 403 `42501`).
- Não houve nenhum `GET /rest/v1/catalogo_mestre` antes — o código atual em `src/components/ImportErpModal.tsx` (linhas 137‑145) faz esse lookup por EAN. Se estivesse rodando, os 5 itens (todos com EAN existente no `catalogo_mestre`) iriam direto para o bucket "catalogo" e nem tocariam `produtos`.
- No banco: `cotacoes 3a3c4f8d-…` foi criada com `created_by` correto, mas `cotacao_produtos` está em 0 — o insert nunca aconteceu porque o modal antigo abortou no `produtos`.

Ou seja: o código-fonte já está correto, mas o bundle que rodou no navegador do usuário era anterior à última correção — e além disso ele **engoliu** o erro RLS silenciosamente (mostrou "0 novos itens" em vez do erro do Postgres).

## Plano

1. **Não reescrever a lógica de importação.** O fluxo atual (match por EAN → catálogo → local → snapshot) está certo e todos os 5 EANs do `pedido_teste.xlsx` já casam no `catalogo_mestre`.
2. **Tornar o modal auto-diagnóstico** em `src/components/ImportErpModal.tsx`:
   - No início de `doImport`, `console.log` com marca de versão (`"[ImportErp v2]"`), contagem de itens, EANs detectados.
   - Após o `catalogByEan`, logar quantos casaram e quantos foram para `toCreateLocal`.
   - Se `buckets.length === 0` e `toCreateLocal.length === 0`, mostrar `toast.error` explícito ("Nenhum item foi processado — verifique se o arquivo tem colunas Produto/EAN") em vez de "0 novos itens adicionados!".
   - Se o `insert` em `produtos` falhar com código `42501`, mostrar mensagem clara: "Sessão expirada ou sem permissão — recarregue a página (Ctrl+Shift+R) e tente novamente." em vez de só repassar a mensagem crua.
3. **Forçar cache-bust do bundle**: adicionar um comentário `// build: erp-import-v2` no topo do arquivo para garantir hash de chunk novo, e pedir ao usuário para dar refresh forte na primeira tentativa após deploy.
4. **Sem alterações no backend, RLS, migrations, `buildSnapshotInsert` ou schema.** O banco está saudável e a política de `produtos`/`cotacao_produtos` está correta — o `created_by` da cotação recém-criada bate com `auth.uid()`.
5. **Validação manual pós-deploy** (usuário faz):
   - Fazer refresh forte (Ctrl+Shift+R / Cmd+Shift+R no mobile: fechar aba e reabrir).
   - Importar o mesmo `pedido_teste.xlsx`.
   - Esperado: toast "5 novos itens adicionados!" e os 5 produtos do catálogo aparecendo na cotação ativa, sem passar por `produtos` local.

## Detalhes técnicos

- Arquivo único tocado: `src/components/ImportErpModal.tsx`.
- Nenhum teste novo é necessário — `ImportErpModal.test.tsx` já cobre `extractEan` e detecção de colunas.
- Não mexer em `DashboardPage.tsx`, `startErpImport.ts`, nem nas migrations recentes de `cotacoes` / `set_cotacao_created_by`.