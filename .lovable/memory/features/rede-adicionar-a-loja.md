---
name: Adicionar fornecedores da Rede a uma loja (Admin)
description: Etapa 3 da Rede — seleção em lote na visão Rede do Admin e vínculo silencioso de fornecedores à loja de um cliente
type: feature
---

## Fluxo
- Visão "Rede" (Admin → Rede de Fornecedores) tem checkbox por fornecedor, "Selecionar todos da página" e "Limpar seleção".
- Barra sticky mostra a contagem e o botão "Adicionar a uma loja" (`AdicionarALojaDialog`).
- No diálogo: busca por cliente/loja/cidade/e-mail, escolha da loja, chips dos selecionados com remoção, confirmação.

## Regra de negócio
- **100% silencioso**: nenhum e-mail, WhatsApp ou notificação ao cliente. Só é feito mediante solicitação do cliente.
- Se o cliente já tem o fornecedor na carteira (mesmo últimos 8 dígitos do telefone, ou nome+representante normalizados), apenas cria o vínculo em `fornecedor_lojas`.
- Se não tem, clona o cadastro com `user_id` do dono da loja (novo token) e copia `fornecedor_cidades_atendidas`, depois vincula.
- Retorna `{criados, vinculados, ja_vinculados}`; `resumoVinculoLabel()` formata a mensagem pt-BR.

## RPCs (SECURITY DEFINER + is_admin, search_path public)
- `admin_list_lojas_clientes(_search)` — lojas de todos os clientes com cidade/UF, nome/e-mail do cliente e total de fornecedores (limite 200).
- `admin_vincular_fornecedores_loja(_loja_id, _fornecedor_ids)` — retorna jsonb com o resumo.

## Arquivos
- `src/components/admin/AdicionarALojaDialog.tsx` (+ `.test.ts`)
- `src/components/admin/RedeUnificadaLista.tsx` (seleção)
