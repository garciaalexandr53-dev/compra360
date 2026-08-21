# Aba "Candidatos" no painel /admin

Nova aba somente leitura ao lado de Catálogo e Histórico, listando produtos com código de barras cadastrados pelos clientes que ainda não existem no catálogo mestre — com ação de cadastrar reaproveitando o sheet existente.

## Por que precisa de uma função no banco

As políticas de acesso atuais permitem que cada cliente leia apenas os próprios `produtos` e `itens_faltantes` (verificado). Um admin, consultando direto pelo app, veria uma lista vazia. Então a listagem vem de uma nova função de banco com privilégio elevado, protegida por verificação de admin (`is_admin()`), sem alterar tabelas nem as buscas existentes.

Volume atual: 14 candidatos distintos (1 do App Funcionários, 13 de catálogos locais) — lista pequena, sem necessidade de paginação nesta etapa.

## Listagem

Cada candidato mostra:

- Nome informado pelo cliente (o mais recente daquele EAN)
- EAN
- Embalagem e fator, quando informados
- Origem: "App Funcionários" (itens_faltantes) ou "Catálogo local" (produtos); se vier das duas, mostra as duas
- Contador de ocorrências do EAN (indicador de relevância)

Ordenação pelos mais recentes. Busca simples por nome ou EAN. Contador de total.

Desktop: tabela (nome, EAN, embalagem/fator, origem, ocorrências, ação).
Mobile 360px: cards empilhados, nome em destaque, EAN + embalagem em linha secundária, badges de origem e ocorrências, botão de ação em largura cheia.

Estado vazio: "Nenhum candidato no momento. Produtos com código de barras cadastrados pelos clientes que ainda não existem no catálogo mestre aparecerão aqui."

## Ação "Cadastrar no catálogo"

Abre o `CatalogoItemSheet` já existente em modo novo item, pré-preenchido com nome, EAN, embalagem e fator do candidato. O admin ajusta o nome ao padrão e salva. Após salvar, a lista é revalidada e o candidato desaparece (o EAN passa a existir no mestre). Sem tabela de rejeitados: candidato sem interesse permanece na lista.

## Detalhes técnicos

- Migração: `admin_list_candidatos_catalogo()` SECURITY DEFINER, `SET search_path = public`, com a guarda obrigatória no início do corpo: `if not public.is_admin() then raise exception 'forbidden'; end if;` — sem ela qualquer usuário autenticado leria produtos de todos os clientes. Une:
  - `itens_faltantes` com `ean is not null` e `catalogo_mestre_id is null`
  - `produtos` com `ean` não vazio
  ambos excluindo EANs já presentes em `catalogo_mestre` e aceitando somente EANs válidos — `length(regexp_replace(ean,'\D','','g')) in (8,12,13,14)` — para não deixar digitação errada entrar na fila. Agrupa pelo EAN normalizado (só dígitos) retornando `ean, nome` (mais recente), `embalagem`, `fator_embalagem`, `origens text[]`, `ocorrencias int`, `ultimo_em timestamptz`. `grant execute` para `authenticated`.
- `CatalogoItemSheet` recebe um novo formato de prop para "novo com valores iniciais" (ex.: `{ modo: "novo", inicial: {...} }`), mantendo compatível o uso atual em `CatalogoTab` — sem duplicar formulário nem validações.
- Novo `src/components/admin/CandidatosTab.tsx` + `TabsTrigger`/`TabsContent` em `src/pages/AdminPage.tsx` (grid da `TabsList` passa a 9 colunas no desktop, mantendo 3 por linha no mobile).
- TanStack Query com invalidação da query de candidatos após salvar; embalagem normalizada via `@/lib/embalagem` / `embalagemFatores`.
- Testes unitários para o mapeamento/normalização dos candidatos (dedupe por EAN, rótulo de origem, fator padrão quando ausente).
