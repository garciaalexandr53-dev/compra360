---
name: Gestão de Lojas
description: LojasPage redesenhada com cards clicáveis, sheet de detalhes com métricas navegáveis, nome_fantasia separado de razão social
type: feature
---
A página `/lojas` (`src/pages/LojasPage.tsx`) segue o padrão visual da `FornecedoresPage`: header verde "Lojas" + contador + busca por nome fantasia/razão social/CNPJ + botão "Nova Loja". Cards (componente `LojaCard` em `src/components/lojas/`) são totalmente clicáveis (sem ícones lápis/lixeira) e exibem grid 2x2 com métricas (produtos ativos, fornecedores vinculados, cotações do mês, última cotação). Loja ativa recebe destaque com fundo `success/5` + borda `success/40`.

Ao tocar no card abre `LojaSheet` (bottom sheet centralizado em desktop) com: header (nome fantasia + razão social + badge ATIVA ou botão "Ativar loja"), seção "Dados cadastrais" (razão social, CNPJ, IE, endereço), seção "Métricas — toque para navegar" com 4 cards clicáveis que ativam a loja e navegam para `/produtos`, `/fornecedores`, `/historico` ou abrem a última cotação via `?id=`, e seção "Ações rápidas" (Editar, Cotação ativa, Histórico, Excluir com confirmação inline em 2 toques).

A tabela `lojas` ganhou a coluna `nome_fantasia` (text, opcional) — `getDisplayName()` em `lojaUtils.ts` prioriza fantasia com fallback para `nome`. Métricas são carregadas em uma única bateria de queries paralelas (`Promise.all` de `fornecedor_lojas`, `cotacoes`, `produtos`) indexadas por `loja_id` no frontend, evitando N+1. Componentes separados: `LojaCard.tsx`, `LojaSheet.tsx`, `LojaEditModal.tsx`, `lojaUtils.ts` (com testes em `lojaUtils.test.ts` cobrindo `isLojaAtiva`, `getDisplayName`, `formatCNPJ`).
