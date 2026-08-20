# Gestão do Catálogo Mestre no Admin

Nova aba "Catálogo" no painel `/admin`, com o mesmo controle de acesso das outras telas administrativas (verificação de admin já feita na página). Sem mudanças na tabela nem nas funções de busca existentes.

## Listagem

- Lista paginada de `catalogo_mestre` (11.685 itens hoje), 50 por página.
- Busca única: se o termo for só dígitos, busca por EAN (prefixo); senão por nome.
- Desktop: tabela com nome, EAN, embalagem, fator, ativo e botão editar.
- Mobile (360px): cards empilhados com nome em destaque, EAN/embalagem/fator em linha secundária, badge "Inativo" quando aplicável.
- Filtros rápidos: "Todos", "Sem EAN" (1.931 itens), "Inativos" (118 itens).
- Contador de total de resultados do filtro/busca atual.

## Editar item

Sheet lateral (desktop) / bottom sheet (mobile) com:

- Nome (obrigatório)
- EAN (texto, só dígitos, pode ficar vazio)
- Embalagem (select: UNI, CX, DZ, DP, FD, KG, PCT, LT)
- Fator de embalagem (inteiro ≥ 1)
- Ativo (switch)

Validações:

- Fator ≥ 1 — bloqueia salvar se inválido.
- EAN preenchido deve ter 8, 12, 13 ou 14 dígitos — bloqueia salvar.
- Embalagem CX/DZ/DP/FD com fator = 1 — aviso amarelo, permite salvar.
- Ao salvar com EAN, consulta se outro item do mestre já usa aquele EAN; se sim, mostra o nome do item conflitante e pede confirmação antes de gravar.

## Novo item

Mesmo formulário, EAN opcional. Antes de gravar, busca possíveis duplicatas (mesmo EAN e nomes semelhantes por palavras-chave normalizadas) e lista até 5 candidatos para o admin confirmar ou cancelar.

## Inativar

Sem exclusão. Apenas alterna `ativo = false` (itens inativos continuam fora das buscas dos clientes, conforme a política de leitura atual). Reativação pelo mesmo switch.

## Detalhes técnicos

- Novo componente `src/components/admin/CatalogoTab.tsx` + `CatalogoItemSheet.tsx`, ligados por uma `TabsTrigger`/`TabsContent` em `src/pages/AdminPage.tsx`.
- Leitura/escrita direto via client Supabase: a policy `Admin can write catalogo_mestre` (`is_admin()`, cmd ALL) já cobre select de inativos, insert e update, e os privilégios de tabela para `authenticated` já existem — nenhuma migração necessária.
- Paginação com `.range()` e `count: "exact"`; TanStack Query com `keepPreviousData` e debounce de 300 ms na busca.
- Siglas de embalagem e fatores padrão reaproveitados de `@/lib/embalagem` / `@/lib/embalagemFatores`.
- Normalização de nome para detecção de duplicatas reaproveitando a abordagem NFD já usada no projeto (`src/lib/buscaProdutos.ts`).
- Testes unitários para as validações (fator, EAN, aviso de fator em embalagem fechada) e checagem de duplicata.
