# Corrigir assinatura manual do Mercado Olímpico e a causa do rebaixe

## O que os dados mostram

- A assinatura do cliente está hoje: **business, manual, anual, ativa**, com vencimento em **20/08/2029** — errado.
- Existem **3 registros de pagamento manual** para ele:
  1. 19/08/2026 — R$ 869,00, Pix, período até **20/08/2027** (correto)
  2. 24/08/2026 — sem valor, período até 20/08/2028 (duplicado)
  3. 24/08/2026 — R$ 869,00, período até 20/08/2029 (duplicado)
- Cada registro encadeia 12 meses a partir do vencimento anterior, por isso "1091 dias restantes".

## Por que ele caiu para o Free (mensagem "Limite atingido: 23/4")

O limite 4 fornecedores é exatamente o do plano Free — ou seja, no momento do bloqueio o sistema já não reconhecia a assinatura Business.

Causa: a função `check-subscription`, que roda a cada login/abertura do app, consulta o Stripe pelo e-mail do cliente. Como esse cliente pagou por Pix e **não existe no Stripe**, a função marca todas as assinaturas ativas dele como `canceled` — ela não distingue assinaturas manuais. A rotina de re-sincronização já ignora assinaturas manuais; a `check-subscription` não. Foi isso que rebaixou o cliente, e não o ciclo anual.

## Correção proposta

### 1. Corrigir os dados do cliente (agora)
- Remover os 2 pagamentos manuais duplicados de 24/08/2026.
- Voltar o vencimento da assinatura para **20/08/2027** (12 meses do Pix real), mantendo status `active`, plano `business`, origem `manual`.
- Resultado: aparece "business · anual · Pix · R$ 869,00 · vence em 20/08/2027", ~361 dias restantes.

### 2. Corrigir a causa (para não repetir com nenhum cliente)
- `check-subscription` passa a **não mexer em assinaturas com `origem = 'manual'`**: se a assinatura ativa é manual e está no prazo, ela devolve o plano manual e não consulta cancelamento no Stripe.
- Assim, cliente pago por Pix nunca mais é rebaixado ao abrir o app.

### 3. Evitar o registro duplicado no painel
No diálogo de pagamento manual (`PagamentoManualDialog`), quando o cliente já tem assinatura manual válida por mais de 30 dias, mostrar aviso claro antes de confirmar: "Este cliente já está pago até DD/MM/AAAA. Registrar outro pagamento vai estender para DD/MM/AAAA." — com confirmação explícita. Isso evita o encadeamento acidental que aconteceu hoje.

## Detalhes técnicos

- Dados: `DELETE` dos 2 registros em `pagamentos_manuais` (ids de 24/08) + `UPDATE public.subscriptions SET current_period_end = '2027-08-20 02:59:59+00' WHERE id = 'ae8b7bb8-…'`.
- `supabase/functions/check-subscription/index.ts`: antes de consultar o Stripe, ler a assinatura do usuário; se `origem = 'manual'` e `current_period_end > now()`, retornar o plano direto. No trecho que marca `canceled`, adicionar filtro `.neq('origem','manual')`.
- `src/components/admin/PagamentoManualDialog.tsx`: aviso/confirmação quando `current_period_end` está a mais de 30 dias no futuro. Layout validado em 360px e desktop.
