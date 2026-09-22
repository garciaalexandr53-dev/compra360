---
name: Visão Unificada da Rede (Admin)
description: Aba Rede do Admin agrupa fornecedores por WhatsApp/nome+representante via RPC admin_list_rede_fornecedores, com filtros de cidade/UF/categoria
type: feature
---

Etapa 2 da Rede de Fornecedores (Admin → Rede de Fornecedores → visão "Rede"):

- RPC `admin_list_rede_fornecedores(_search, _cidade, _uf, _tipo, _somente_rede, _limit, _offset)` — SECURITY DEFINER + `is_admin()`, `SET search_path = public`. Agrupa por chave `f:<dígitos do telefone sem 55, >=10>` ou `n:<nome_norm>|<rep_norm>`. Retorna cadastros, clientes, lojas_vinculadas, cidades (de `fornecedor_cidades_atendidas`), clientes_nomes, na_rede, total_count. Registro mestre do grupo prioriza origem autocadastro, depois o mais antigo.
- RPC `admin_rede_filtros()` — cidades/UF disponíveis para os selects.
- Ambas com EXECUTE revogado de anon/public; concedido a authenticated e service_role.
- Frontend: `src/components/admin/RedeUnificadaLista.tsx` (badges Rede / N cadastros / categoria, presença "X clientes · Y lojas", cidades atendidas, tabela desktop + cards mobile). `FornecedoresTab.tsx` desativa a query antiga quando `visao === "rede"`.
- Base real: 119 cadastros → 61 fornecedores únicos.

Próximas etapas pendentes: 3) ação em lote "Adicionar fornecedores a uma loja" (silenciosa, só vínculo em `fornecedor_lojas`) — concluída (ver mem://features/rede-adicionar-a-loja); 4) merge de duplicados — concluída (ver mem://features/rede-unificacao-duplicados).
