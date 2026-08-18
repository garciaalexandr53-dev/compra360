# Re-sincronização de assinaturas + botão no painel admin

## Sua dúvida: já é automático?

Sim, em parte. Hoje existem dois caminhos automáticos:

1. **Webhook do Stripe** (`stripe-webhook`): recebe eventos de checkout, renovação, cancelamento e falha de pagamento e atualiza o banco.
2. **`check-subscription`**: roda quando o cliente faz login/abre o app e reconcilia o plano dele com o Stripe.

Onde isso falha hoje (verificado no código e nos dados):

- O webhook só atualiza uma linha que **já tenha `stripe_customer_id` salvo**. Se o cliente pagou antes de o app ter gravado esse ID, o evento é ignorado com "No matching subscription row for customer".
- Se o segredo de assinatura do webhook ficar dessincronizado (foi o que aconteceu recentemente), todos os eventos são rejeitados e o banco fica parado.
- O `check-subscription` só corrige o plano do cliente **que estiver logado** — quem não entra fica com dado velho.
- Nada expira trial interno vencido: hoje há registros com status ativo/trial e período já encerrado (ex.: períodos terminados em maio, junho, julho e 07/08).

Estado atual conferido: no Stripe live existe **1 assinatura paga ativa** (Business mensal). Os demais registros ativos/trial do banco são trials internos, sem vínculo com Stripe.

## O que vamos construir

### 1. Função de backend `admin-resync-subscriptions`
- Acesso restrito a admin (valida JWT + `has_role(uid,'admin')`).
- Percorre todas as assinaturas do Stripe (paginado, `status: all`) e, para cada uma:
  - identifica o cliente pelo `stripe_customer_id` ou, se não achar, pelo **e-mail do customer** contra `auth.users` (é isso que resolve o caso "pagou e continua Free");
  - resolve o plano por `product_id` com fallback por `price_id`;
  - grava status, `stripe_subscription_id`, `stripe_customer_id`, início/fim de período e `canceled_at`.
- Marca como `canceled` quem está ativo no banco com assinatura Stripe que não está mais ativa.
- Expira trials internos vencidos: status ativo/trial, sem assinatura ativa no Stripe e `current_period_end` no passado viram `canceled` (cliente volta ao Free).
- Aceita `dry_run: true` e devolve relatório: total no Stripe, atualizados, criados, cancelados, trials expirados, não vinculados (com e-mail), erros.

### 2. Correção no webhook
Aplicar o mesmo fallback por e-mail do customer no `upsertSubscription`, para o evento não ser descartado quando o `stripe_customer_id` ainda não estiver salvo.

### 3. Botão no painel administrativo
Na área de assinaturas/Stripe do `/admin`:
- Botão "Re-sincronizar assinaturas" com estado de carregamento.
- Primeiro clique roda em **simulação** e abre um resumo do que mudaria; um segundo botão "Aplicar" confirma e executa de verdade.
- Ao final, toast com o resumo e recarregamento das listas de clientes.
- Layout responsivo (360px e desktop).

### 4. Execução da correção agora
Depois de publicar a função, rodo a simulação, mostro o relatório e aplico a sincronização real.

## Detalhes técnicos

- Nova função: `supabase/functions/admin-resync-subscriptions/index.ts` (CORS, `verify_jwt=false` com validação em código, service role para escrita).
- Reaproveita os mapas de plano por produto/preço já existentes, centralizando-os em `supabase/functions/_shared/stripeTiers.ts` para webhook, `check-subscription` e a nova função usarem a mesma fonte.
- Leitura de período com fallback para `items.data[0].current_period_*` e conversão segura para ISO (mesmo padrão já corrigido no webhook).
- Sem migração de banco: usa apenas a tabela `subscriptions` e `plans` existentes.
