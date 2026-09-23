---
name: Painel de Consentimento da Rede
description: Aba Consentimento no Admin lista fornecedores agrupados por WhatsApp/CNPJ com status, CNPJ, tipo, pasta e data da última pergunta
type: feature
---

# Painel de Consentimento da Rede (Admin)

Localização: Admin → **Rede de Fornecedores** → aba **Consentimento**
(entre "Rede" e "Por cliente"), renderizada por `ConsentimentoLista.tsx`.

## Backend
RPC `admin_list_consentimentos(_search, _status, _limit, _offset)`, SECURITY DEFINER
com `is_admin()` e `SET search_path = public`. EXECUTE revogado de `anon`.

Agrupa por `grupo_key`:
1. `f:<fornecedor_fone_key>` (últimos 8 dígitos do telefone)
2. `c:<fornecedor_cnpj_key>` (14 dígitos)
3. `n:<nome_norm>|<rep_norm>` (fallback)

Mestre do grupo via `ROW_NUMBER()`: prioriza `consentimento_rede = 'sim'`, depois
`'nao'`, depois quem tem CNPJ, depois `created_at ASC`.

Status consolidado do grupo: qualquer `'sim'` ⇒ `sim`; senão qualquer `'nao'` ⇒ `nao`;
senão `pendente`. `consentimento_ultima_pergunta` e `consentimento_recusas` usam `MAX`
do grupo; CNPJ usa `MAX(cnpj_key)`; cidades são a união de `fornecedor_cidades_atendidas`.

Retorna também `total_count`, `total_sim`, `total_nao`, `total_pendente` (contagem
após filtros), usados nos cards de resumo.

Ordenação: pendentes primeiro, depois recusados, depois participantes;
dentro disso por `ultima_pergunta DESC NULLS LAST` e nome.

## Frontend
- Cards de resumo: Fornecedores / Participam / Recusaram / Pendentes.
- Busca com debounce 300ms por nome, representante, WhatsApp ou CNPJ (dígitos).
- Filtros de status: Todos / Participam / Recusaram / Pendentes.
- Selo colorido: verde `Participa`, vermelho `Recusou`, âmbar `Pendente`.
- Paginação de 50; exportação `.xlsx` busca até 5000 linhas com os mesmos filtros.
- A barra de busca/exportação do `FornecedoresTab` fica oculta nessa aba
  (`hidden`), pois a lista tem busca e exportação próprias.

## Helpers em `src/lib/adminExports.ts`
`ConsentimentoFornecedor`, `formatCnpjBR` (máscara só com 14 dígitos),
`consentimentoLabel`, `ultimaPerguntaLabel` ("Ainda não perguntado" quando nulo),
`CONSENTIMENTOS_HEADER`, `consentimentoRow`, `buildConsentimentosXlsx`,
`consentimentosFilenameXlsx`.

Testes: `src/components/admin/ConsentimentoLista.test.ts`.
