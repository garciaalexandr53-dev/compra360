# Pagamento manual (Pix) com registro de assinatura no sistema

## O problema

Hoje só existe assinatura via Stripe. A liberação manual usa `admin_set_user_plan`, que grava sempre 30 dias e não registra ciclo, valor, forma de pagamento nem histórico. Resultado: cliente anual pago por Pix não aparece como anual, e você precisa liberar de novo todo mês.

## O que vamos construir

### 1. Assinatura manual de verdade
No painel admin, ao liberar um plano, você passa a informar:
- Plano (Pro ou Business)
- Ciclo: mensal (30 dias) ou anual (12 meses)
- Data de vencimento (sugerida pelo ciclo, editável)
- Forma de pagamento: Pix, transferência, dinheiro, boleto, outro
- Valor recebido
- Observação (ex.: "Pix 18/08, comprovante enviado no WhatsApp")

A assinatura fica gravada como **manual**, com a data de vencimento correta. O cliente com Pix anual vira Business ativo por 12 meses, sem liberação mensal.

### 2. Histórico de pagamentos manuais
Cada liberação registra um pagamento (data, valor, forma, período coberto, quem registrou). No perfil do cliente aparece a lista: o que ele pagou, quando e até quando está coberto. Assim você tem o registro que hoje não existe.

### 3. Aviso de vencimento no painel
Nova seção em **Admin → Pagamentos**: "Assinaturas manuais a vencer", listando quem vence em 7, 3 e 1 dia, e quem já venceu. Cada linha tem atalho para cobrar (WhatsApp) e para registrar o novo pagamento, que estende o período a partir do vencimento anterior (sem perder dias).

### 4. Proteções
- A re-sincronização do Stripe passa a ignorar assinaturas manuais, para não cancelá-las por engano.
- Assinatura manual vencida deixa de dar acesso automaticamente (o cliente volta ao Free até você registrar o novo pagamento) — comportamento já existente por data de vencimento.
- Só admin pode registrar, e o registro fica com o autor e a data.

### 5. Cliente atual
Depois da tela pronta, você mesmo registra o cliente do Pix anual (Business, 12 meses, valor e data reais). Nada é alterado no banco antes disso.

## Sobre Pix no Stripe / débito
- Enquanto o suporte do Stripe não liberar o Pix, o fluxo manual é o caminho. Quando liberarem, o Pix aparece no próprio checkout e o webhook já ativa o plano automaticamente — o fluxo manual continua existindo para exceções.
- Cartão de débito no Stripe costuma falhar em assinatura recorrente; a alternativa nesse caso é crédito ou Pix manual. Se quiser, avaliamos depois um provedor nacional (Mercado Pago/Asaas) com Pix e boleto nativos.

## Detalhes técnicos

- Migração em `public.subscriptions`: colunas `origem` (`stripe`/`manual`, default `stripe`), `ciclo` (`mensal`/`anual`), `metodo_pagamento`, `valor_pago`, `observacao`.
- Nova tabela `public.pagamentos_manuais` (user_id, subscription_id, plan_id, valor, metodo, ciclo, periodo_inicio, periodo_fim, observacao, registrado_por, created_at) com GRANTs e RLS: leitura/escrita apenas para admin via `has_role`, `service_role` liberado.
- Nova RPC `admin_registrar_pagamento_manual(_user_id, _plan_name, _ciclo, _vencimento, _metodo, _valor, _observacao)` — SECURITY DEFINER, `SET search_path = public`, checa `is_admin()`, faz upsert em `subscriptions` (status `active`, `origem='manual'`, período a partir do maior entre `now()` e o vencimento atual) e insere em `pagamentos_manuais`. `admin_set_user_plan` continua existindo para uso rápido.
- Nova RPC `admin_list_assinaturas_manuais()` retornando vencimentos, dias restantes, e-mail e último pagamento.
- Front: novo `src/components/admin/PagamentoManualDialog.tsx`; integração no `ClienteDetalhesSheet.tsx` (botão "Registrar pagamento manual" + histórico) e em `PagamentosTab.tsx` (seção de vencimentos). Layout testado em 360px e desktop.
- `supabase/functions/admin-resync-subscriptions/index.ts`: filtros passam a excluir `origem = 'manual'` nas etapas de cancelamento e de expiração de trial.
