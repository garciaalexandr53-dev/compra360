# Sugestões de fornecedores da região

## Objetivo
Quando o lojista abre a tela de Fornecedores, o sistema mostra fornecedores que já atendem outras lojas da mesma cidade e permite adicioná-los à sua carteira com um clique — sem revelar de qual cliente vieram.

## O que muda para você

### Botão de sugestões
- Na barra de ações da tela de Fornecedores, ao lado de "Novo Fornecedor", aparece "Sugestões da região" com a quantidade disponível (ex.: "12 disponíveis"). Só aparece quando existe alguma sugestão.
- Quando a loja ativa não tem cidade preenchida, o botão não aparece e o estado vazio orienta a preencher a cidade em Lojas.

### Estado vazio convidativo
- Sem nenhum fornecedor cadastrado, aparece um card: "Encontramos [N] fornecedores que atendem em [Cidade - UF]. Quer adicioná-los?" com botão para abrir a lista.

### Lista de seleção
- Diálogo "Fornecedores que atendem [Cidade - UF]", com o texto: "Encontramos [N] fornecedores que já atendem outras lojas na sua região — adicione os que fizerem sentido para você."
- Cada item traz: nome da empresa em caixa alta, representante em Title Case, telefone formatado, etiquetas de tipo e pastas, pedido mínimo e prazo quando houver.
- Todos vêm pré-marcados, com "Marcar todos" / "Desmarcar todos".
- Botão "Adicionar [N] selecionados"; ao concluir, mensagem de sucesso e a lista de fornecedores já atualizada.
- Nenhuma informação sobre o cliente de origem é exibida.

### Regras de conteúdo
- Só entram fornecedores vinculados a lojas da mesma cidade (comparação sem acentos e sem diferenciar maiúsculas), excluindo a própria loja.
- Duplicados pelo mesmo telefone aparecem uma única vez (fica o cadastro mais recente).
- Fornecedores cujo telefone já existe na sua carteira não são sugeridos.
- O fornecedor adicionado passa a ser um cadastro seu: você pode editar e excluir sem afetar o cadastro de origem.

## Detalhes técnicos

1. Migração com duas funções `security definer`, `set search_path = public`, `revoke execute from anon`:
   - `sugerir_fornecedores_por_cidade(_loja_id uuid)` — join `fornecedor_lojas → lojas` filtrando pela cidade normalizada da `_loja_id` (`lower(translate(...))` + `btrim`), excluindo `loja_id = _loja_id` e fornecedores do próprio `auth.uid()`; `fone_digits` (só dígitos, corta `55` inicial quando 12/13); dedupe por `DISTINCT ON (fone_key)` mantendo o `created_at` mais recente e, sem telefone, por `(nome_norm, rep_norm)`; exclui telefones já presentes na carteira do usuário. Retorna `id, nome, representante, telefone, tipo_fornecedor, pasta, pedido_minimo, prazo_pagamento`.
   - `copiar_fornecedores_para_loja(_loja_id uuid, _fornecedor_ids uuid[])` — valida `lojas.user_id = auth.uid()` (senão `raise exception`); CTE única: `INSERT INTO fornecedores (nome, representante, telefone, email, pedido_minimo, prazo_pagamento, observacoes, tipo_fornecedor, pasta, user_id, token)` — **`tipo_fornecedor` e `pasta` são copiados explicitamente do fornecedor de origem**, para o novo cliente não receber o fornecedor sem classificação — com `user_id = auth.uid()` e `token = encode(gen_random_bytes(16),'hex')`; `RETURNING id` alimenta o `INSERT INTO fornecedor_lojas (fornecedor_id, loja_id)`. Retorna a quantidade inserida.
   - `gen_random_bytes` vem do `pgcrypto`, já habilitado neste banco (verificado em `pg_extension`); a migração inclui `CREATE EXTENSION IF NOT EXISTS pgcrypto` como garantia idempotente.
2. `src/components/fornecedores/SugestoesRegiaoDialog.tsx` — novo componente com a lista, seleção e mutação; usa `formatNomeEmpresa`, `formatNomePessoa`, `formatTelefone`, `tipoFornecedorLabel`, `pastasLabel`.
3. `src/pages/FornecedoresPage.tsx` — query `["sugestoes-regiao", lojaAtiva?.id]` (habilitada só com `lojaAtiva?.cidade`), botão na linha 2 da toolbar, card no estado vazio e invalidação de `["fornecedores"]` / `["fornecedor-lojas"]` após adicionar.
4. Respeita o limite do plano: a adição passa pelo `useFeatureCheck` (fornecedores) e abre `PlanosModal` quando excede.
5. Sem alterações em RLS existentes, nas consultas atuais ou na regra de duplicidade do Admin. Verificação: `tsgo`, `vitest`, testes novos para a montagem da lista e revisão visual em 360px e desktop.
