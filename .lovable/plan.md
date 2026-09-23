# Deixar o termo "Sugestões da região" mais claro

## Objetivo
Trocar o rótulo "Sugestões da região" por uma frase mais compreensível para o lojista, como "Novos fornecedores disponíveis", em todos os pontos onde aparece — mantendo a mesma lógica e sem mexer em consultas/backend.

## Textos a alterar (somente frontend, pt-BR)

### 1. Botão na tela de Fornecedores (`src/pages/FornecedoresPage.tsx`)
- Linha ~303: `Sugestões da região` → `Novos fornecedores disponíveis`
- Mantém o contador ao lado: `1 disponíveis`.

### 2. Card de estado vazio (`src/pages/FornecedoresPage.tsx`)
- Linha ~352: `Ver sugestões da região` → `Ver fornecedores disponíveis`
- Linha ~348-349: ajustar a frase para "Encontramos N fornecedor(es) disponíveis para sua loja em {cidadeLabel}. Quer adicioná-los?".
- Linha ~358: "...para receber sugestões de fornecedores da região." → "...para receber novos fornecedores disponíveis."

### 3. Banner do Dashboard (`src/components/dashboard/FornecedoresLojaBanner.tsx`)
- Botão (linha ~89): `Ver fornecedores da região` → `Ver fornecedores disponíveis`
- Descrição (linha ~81): manter o contexto da cidade, ajustando para "Encontramos N fornecedor(es) disponíveis para sua loja em {cidadeLabel}. Adicione com 1 clique e agilize suas cotações."

### 4. Diálogo de seleção (`src/components/fornecedores/SugestoesRegiaoDialog.tsx`)
- Título (linha ~68): `Fornecedores que atendem {cidadeLabel}` → `Novos fornecedores disponíveis para sua loja`
- Subtítulo (linha ~73-74): "Encontramos N fornecedor(es) que já atende(m) outras lojas na sua região — adicione os que fizerem sentido para você." → "Encontramos N fornecedor(es) disponíveis para sua loja em {cidadeLabel}. Selecione os que você quer adicionar."

## Fora de escopo
- Não alterar nomes internos de variáveis/estados (sugestoes, queryKey "sugestoes-regiao"), nomes de arquivos nem RPCs — apenas textos visíveis ao usuário.
- Não tocar em consultas, RLS ou backend.

## Verificação
- `tsgo` (typecheck) e `vitest` devem seguir verdes.
- Revisão visual no preview em 360px e desktop para conferir que o botão não quebra em mobile.
