# Tipo e Pasta na ficha do fornecedor (Admin)

Adicionar dois campos novos na ficha do fornecedor dentro do painel administrativo. Nada muda no app do cliente.

## O que o administrador verá

Na ficha lateral do fornecedor, no bloco de dados de contato:

- **Tipo de fornecedor** — lista com três opções: Geral, Bebidas, Especializado. Começa vazio ("Não definido") enquanto ninguém escolher.
- **Pastas** — só aparece quando o tipo escolhido é "Especializado". Permite marcar várias pastas ao mesmo tempo, mostradas como etiquetas selecionáveis:
  Frios e Laticínios · Carnes · Hortifruti · Padaria · Limpeza · Higiene e Beleza · Mercearia · Bebidas · Congelados · Pet

Se o tipo for trocado de "Especializado" para outro, as pastas marcadas são limpas ao salvar.

Nenhum fornecedor já cadastrado recebe valor automático — todos ficam sem tipo e sem pasta até alguém preencher.

## Onde os valores aparecem depois

- Na lista de fornecedores: etiqueta discreta com o tipo (e as pastas, quando houver) na linha secundária do nome, tanto na tabela do desktop quanto no card do mobile.
- Na exportação em Excel: duas colunas novas ao final — "Tipo" e "Pastas" (pastas separadas por vírgula).

## Detalhes técnicos

- Migração: recriar `admin_update_fornecedor` com dois parâmetros extras `_tipo_fornecedor text DEFAULT NULL` e `_pasta text[] DEFAULT NULL`, mantendo `SECURITY DEFINER`, `SET search_path = public`, guarda `is_admin()`, o log de antes/depois e o `REVOKE EXECUTE ... FROM anon` para a nova assinatura. Validar `_tipo_fornecedor IN ('geral','bebidas','especializado')` ou nulo, e zerar `pasta` quando o tipo não for `especializado`.
- Migração: incluir `tipo_fornecedor` e `pasta` no retorno de `admin_get_fornecedor_detalhes` e de `admin_list_fornecedores` (sem alterar filtros, busca ou paginação existentes).
- `src/components/admin/FornecedorAdminSheet.tsx`: acrescentar `tipo_fornecedor` e `pasta` ao tipo `Detalhes` e ao estado do formulário; `Select` do shadcn para o tipo; grade de `Badge`/botões alternáveis para as pastas, renderizada apenas quando `tipo === "especializado"`; enviar os novos parâmetros no `rpc`.
- Constantes `TIPOS_FORNECEDOR` e `PASTAS_FORNECEDOR` (valor + rótulo) em `src/lib/adminHelpers.ts`, usadas pela ficha, pela lista e pelo export.
- `src/lib/adminExports.ts`: `tipo_fornecedor`/`pasta` no tipo `FornecedorAdmin`, duas colunas novas em `FORNECEDORES_HEADER` e em `fornecedorRow`.
- `src/components/admin/FornecedoresTab.tsx`: exibir as etiquetas de tipo/pastas na tabela e nos cards.
- Testes: atualizar `src/lib/adminExports.fornecedores.test.ts` para o novo cabeçalho/linha e cobrir a formatação de pastas (vazio, uma, várias).
- Verificação: `tsgo` + Vitest verdes e conferência visual da ficha em desktop e 360 px.

## Fora de escopo

Formulário do cliente em `FornecedoresPage.tsx`, filtros por tipo/pasta na lista e a Rede/Vitrine de fornecedores.
