---
name: Painel Admin Avançado
description: AdminPage com cards clicáveis (Sheets de detalhe), aba Alertas, badge de saúde do cliente e modal de contato com mensagens prontas
type: feature
---
O painel `/admin` (`src/pages/AdminPage.tsx`) tem 3 abas: Métricas, Alertas e Clientes. Helpers compartilhados em `src/lib/adminHelpers.ts` calculam saúde do cliente (🟢 ativo, 🟡 risco, 🔴 dormindo, ⚪ novo) com base em `ultima_cotacao_at` e `created_at`. Cards de métrica abrem `MetricSheets` lateral com a lista filtrada (clientes pagantes, trials, lojas, etc.). A aba Alertas (`AlertasTab`) traz 3 seções: trials expirando ≤7d, em risco de churn, novos da semana com checklist de onboarding. Botões WhatsApp (verde) e Email (azul) abrem o `ContatoModal` com mensagem pré-preenchida pela função `getMensagem(situacao, cliente)`. A RPC `admin_list_clientes` usa `DISTINCT ON (u.id)` para evitar duplicatas e devolve `ultima_cotacao_at`. A RPC `admin_global_metrics` inclui `trials_expirando_7d`, `em_risco_churn` e `taxa_ativacao` (% usuários com ≥1 cotação).
