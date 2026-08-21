# Aba "Histórico" no painel /admin

Nova aba somente leitura ao lado de "Catálogo", com o mesmo gate de admin já aplicado na página. Nenhuma mudança no banco.

## Listagem

- Fonte: `catalogo_mestre_log`, ordenada por `alterado_em` desc, 50 registros por página com contador total.
- Cada linha traz:
  - Data/hora no formato brasileiro (dd/mm/aaaa HH:mm).
  - Ação com badge colorido: Criado (verde), Editado (azul), Removido (vermelho).
  - Nome do item: `dados_depois->>'nome'`, com fallback para `dados_antes->>'nome'` (caso de DELETE).
  - Quem alterou, nesta ordem: "Você" quando `alterado_por` é o usuário logado; e-mail quando resolvido no mapa; UUID abreviado (8 primeiros caracteres) quando não; "Sistema" quando `alterado_por` for nulo.
- Desktop: tabela. Mobile 360px: cards empilhados com data/ação na primeira linha, nome em destaque e autor abaixo.
- Estado vazio explicando que as alterações do catálogo mestre aparecerão ali.

## Detalhe da alteração

Sheet lateral (desktop) / bottom sheet (mobile) aberto ao clicar na linha:

- UPDATE: apenas os campos que realmente mudaram, no formato `campo: valor antes → valor depois`. Campos iguais e o campo `id` são ignorados.
- INSERT: lista dos valores criados.
- DELETE: lista dos valores removidos.
- Rótulos em português (Nome, EAN, Embalagem, Fator de embalagem, Ativo) e valores formatados (Sim/Não para booleanos, "—" para vazios).
- Cabeçalho do sheet com nome do item, ação, data/hora e autor.

## Filtros

- Busca por nome do item (debounce de 300 ms).
- Ação: Todas / Criados / Editados / Removidos.
- Período: últimos 7 dias / 30 dias / tudo.
- Filtros e busca resetam a paginação.

## Somente leitura

Nenhum botão de editar, excluir ou reverter nesta aba.

## Detalhes técnicos

- Novos arquivos: `src/components/admin/HistoricoCatalogoTab.tsx` e `src/components/admin/HistoricoCatalogoSheet.tsx`, ligados por `TabsTrigger`/`TabsContent` em `src/pages/AdminPage.tsx` (segue o padrão de `CatalogoTab`).
- Leitura direta via client Supabase com `.select(..., { count: "exact" })`, `.order("alterado_em", { ascending: false })` e `.range()`; TanStack Query com `placeholderData` para paginação suave. A policy de leitura por `is_admin()` já cobre o acesso.
- Busca por nome sobre JSONB: filtro `or("dados_depois->>nome.ilike.%termo%,dados_antes->>nome.ilike.%termo%")`.
- Período: `gte("alterado_em", <iso>)`.
- E-mails: `auth.users` não é acessível pelo client, e o plano não cria nada no banco. O mapa `user_id → e-mail` vem da RPC existente `admin_list_clientes` (já usada na aba Clientes), cacheada por query própria; autores fora dessa lista caem no UUID abreviado.
- Diff e formatação de valores em um helper puro novo (`src/lib/catalogoLog.ts`) com testes unitários: campos alterados, ignorar `id`, INSERT/DELETE, formatação de booleanos e nulos.
- Verificação visual com Playwright em 360px e desktop.
