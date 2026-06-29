## Busca híbrida de produtos (catálogo global + local) com snapshot na cotação

Visão geral: introduzir busca unificada nas duas telas onde produtos viram itens de cotação — `AddProdutosCotacaoPage` (cliente) e `AppFuncionariosPublic` (funcionário público). A busca consulta `catalogo_mestre` (global, com EAN) E `produtos` (local). A inserção em `cotacao_produtos` grava um snapshot imutável de `nome`, `ean`, `tipo_embalagem`, `fator_embalagem`.

Boa notícia: `cotacao_produtos` já tem as colunas `catalogo_mestre_id`, `nome`, `ean`, `tipo_embalagem`, `fator_embalagem` — então **nenhuma migração de schema é necessária**.

### 1. Backend (RPCs SECURITY DEFINER)

Criar duas RPCs novas em uma migração:

- `search_produtos_hibrido(_termo text, _limit int default 30)` — para usuário autenticado:
  - Busca em `catalogo_mestre` (ativo=true) por `nome ILIKE %termo%` OU `ean LIKE termo%` (quando numérico).
  - Busca em `produtos` (ativo=true, user_id=auth.uid()) por `nome ILIKE %termo%`.
  - Dedupe na fonte: exclui locais cujo `lower(nome)` já apareceu no global.
  - Retorna lista unificada: `fonte` (`'catalogo' | 'local'`), `id`, `nome`, `ean`, `embalagem`, `fator_embalagem`. Globais primeiro.

- `search_produtos_funcionario(_loja_id uuid, _termo text, _limit int default 30)` — anônima:
  - Mesma lógica, mas `produtos` filtra por `user_id = owner da loja` (via `get_loja_owner`). Globais primeiro.

Sem novas tabelas → sem novas GRANTs além das chamadas (RPCs SECURITY DEFINER).

### 2. Lib compartilhada

Novo `src/lib/buscaProdutos.ts`:
- Tipos `FonteProduto = 'catalogo' | 'local'` e `ProdutoBusca`.
- `montarSnapshotCotacao(item: ProdutoBusca, quantidade, embOverride?, fatorOverride?) → InsertCotacaoProduto` — única função que monta o payload de insert respeitando as regras:
  - global → `catalogo_mestre_id=id`, `produto_id=null`, snapshot nome/ean/emb/fator do catálogo, **ignora overrides** de emb/fator.
  - local → `produto_id=id`, `catalogo_mestre_id=null`, `ean=null`, snapshot nome, emb/fator do local (sem override).
- `formatarLabelFonte` para badge.
- Testes unitários: `src/lib/buscaProdutos.test.ts` cobrindo dedup logic (mockando RPC) e snapshot.

### 3. Frontend — `AddProdutosCotacaoPage`

- Substituir `produtos-search` por `useQuery` que chama `search_produtos_hibrido`.
- A listagem inicial (sem termo) continua mostrando produtos locais (mantém comportamento atual de "Seus produtos").
- No diálogo de quantidade: se `fonte==='catalogo'`, badge "Catálogo" + campos embalagem e fator com `disabled`/somente leitura e tooltip "Travado pelo catálogo". Se local, editável como hoje.
- "Cadastrar como novo produto" só aparece quando a busca híbrida retornou 0 resultados.
- `handleContinue`: usar `montarSnapshotCotacao` para cada item; remover lógica que cria novo produto para itens vindos do catálogo.

### 4. Frontend — `AppFuncionariosPublic`

- Adicionar busca via `search_produtos_funcionario` no diálogo de adicionar item.
- Itens locais já existem na listagem atual (RPC `get_produtos_for_loja`) — manter, mas mesclar com sugestões do catálogo quando o funcionário digita.
- Embalagem/fator sempre travados (já é o comportamento).
- Ao salvar item em `itens_faltantes`, persistir `catalogo_mestre_id` na observação ou (preferido) extender `itens_faltantes` apenas se necessário. Para escopo mínimo: persistir EAN/nome do catálogo na observação já existente e usar snapshot quando o cliente importa em `FuncionariosPage`. Mantém o ciclo atual sem mudanças disruptivas em `itens_faltantes`.

### 5. Exibição (histórico e cotação)

- `TabelaCotacao.tsx`, `CotacaoPage.tsx`, `HistoricoPage.tsx`, `historicoExports.ts`: trocar leitura do nome para `cp.nome ?? cp.produtos?.nome` priorizando snapshot. Mostrar EAN quando presente. Badge "Catálogo" quando `catalogo_mestre_id` existir.
- Edição inline do nome: bloquear quando item é do catálogo.

### 6. Testes

- `buscaProdutos.test.ts`: dedup, ordenação global-primeiro, montagem de snapshot com ambas as fontes, override só vale para local.
- Estender `publicPagesNoDirectTableAccess.test.ts` para incluir `catalogo_mestre` na blacklist de páginas públicas.
- Smoke test responsivo via Playwright após implementação (360px e 1280px) para confirmar layout do badge "Catálogo" e diálogo travado.

### 7. Estrutura técnica
```
supabase/migrations/<ts>_busca_hibrida.sql   (2 RPCs)
src/lib/buscaProdutos.ts                     (lógica compartilhada)
src/lib/buscaProdutos.test.ts                (unit tests)
src/pages/AddProdutosCotacaoPage.tsx         (refactor busca + snapshot)
src/pages/AppFuncionariosPublic.tsx          (refactor busca)
src/components/cotacao/TabelaCotacao.tsx     (snapshot + badge)
src/pages/CotacaoPage.tsx                    (edit guard + display)
src/pages/HistoricoPage.tsx                  (display via snapshot)
src/lib/historicoExports.ts                  (export usa snapshot)
src/pages/publicPagesNoDirectTableAccess.test.ts (catalogo_mestre na lista)
```

Quer que eu execute?