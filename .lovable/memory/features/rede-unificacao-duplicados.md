---
name: Unificação de fornecedores duplicados (Merge) no Admin
description: Etapa 4 da Rede — aba Duplicados agrupa cadastros por WhatsApp ou nome+representante e permite unificar, transferindo vínculos para o cadastro principal
type: feature
---

Etapa 4 da Rede de Fornecedores (Admin → Rede de Fornecedores → Duplicados):

## Visão Duplicados
- Lista grupos (mesmo WhatsApp, últimos dígitos sem o 55; ou mesmo nome + representante normalizados) com mais de um cadastro.
- Cada cadastro mostra cliente dono, cidade/UF, lojas vinculadas e total de relacionamentos (lojas, cidades atendidas, cotações, preços, pedidos, envios, acessos).
- Mestre sugerido = auto-cadastro primeiro, depois o mais antigo; admin pode trocar a seleção por rádio.
- Paginação por grupos (30 por página); busca por nome/representante/WhatsApp/e-mail/loja/cliente.

## RPCs (SECURITY DEFINER + is_admin, search_path public; EXECUTE revogado de anon/public, concedido a authenticated e service_role)
- `admin_list_duplicados(_search, _limit=30, _offset=0)` — retorna por cadastro: id, nome, representante, telefone, email, created_at, user_id, cliente_nome, cliente_empresa, cidade, uf, origem_cadastro, tipo_fornecedor, lojas_vinculadas, total_relacionamentos, grupo_key, grupo_tipo ('whatsapp'|'nome'), mestre_sugerido, total_grupos, total_count.
- `admin_unificar_fornecedor(_mestre_id, _sobressalente_ids uuid[])` — retorna jsonb `{mestre_id, unificados, relacionamentos_movidos}`.

## Regras do merge
- Tabelas com unicidade por fornecedor: move só os vínculos sem conflito; quando o mestre já tem o vínculo, o do sobressalente é descartado.
  - `fornecedor_lojas` (loja_id), `fornecedor_cidades_atendidas` (cidade_norm + uf), `cotacao_fornecedores` (cotacao_id), `precos` (cotacao_produto_id).
- Tabelas sem unicidade por fornecedor: reatribui tudo ao mestre.
  - `pedidos`, `historico_envios`, `fornecedor_acessos`.
- Preenche campos nulos do mestre com os do sobressalente (telefone, e-mail, representante, observações, pedido mín., prazo, categoria, CNPJ, pastas, consentimento 'sim' se algum tiver).
- Remove o cadastro sobressalente (ON DELETE CASCADE limpa as sobras conflitantes).
- 100% silencioso: nenhum e-mail, WhatsApp ou notificação é gerado.

## Arquivos
- `src/components/admin/DuplicadosLista.tsx` (+ `.test.ts`) — `DuplicadoCadastro`, `ResumoUnificacao`, `resumoUnificacaoLabel`, `agruparDuplicados`, `GrupoDuplicado`; AlertDialog de confirmação; invalida `admin-duplicados`, `admin-rede-unificada` e `admin-fornecedores`.
- `src/components/admin/FornecedoresTab.tsx` — renderiza `DuplicadosLista` quando `visao === "duplicados"`; query antiga habilitada só em `registros`.

## Base real
- 37 grupos com duplicatas · 103 cadastros (no momento da implantação).
