# Pix à vista somente no plano Anual

## O que o cliente vai ver
- Na aba **Anual** do modal de planos, aparece o selo "Aceitamos Cartão e Pix à vista".
- Nos planos anuais, há dois botões: **Assinar com Cartão** (renova sozinho todo ano) e **Pagar com Pix** (paga o ano à vista; não renova sozinho).
- Na aba **Mensal**, nada muda: só cartão.
- Depois de pagar o Pix, o plano é liberado sozinho por 365 dias.

## Como funciona
O Pix do Stripe liberado para você não é recorrente. Por isso, ele não serve para assinatura automática. No Pix, o Stripe faz uma cobrança única do valor anual. Quando o pagamento é confirmado, o sistema libera o plano por 1 ano. No fim desse período, o cliente renova de novo, pagando com Pix ou cartão.

## Detalhes técnicos
1. **create-checkout**: aceita `metodo: "cartao" | "pix"`.
   - Para `pix`, permite somente `pro_anual` e `business_anual`. Qualquer outro preço retorna erro 400.
   - Cria a sessão com `mode: "payment"`, `payment_method_types: ["pix"]`, o mesmo `price` anual e `metadata { user_id, plano, origem: "pix" }`.
   - Para cartão, mantém o fluxo atual em `mode: "subscription"`, sem mudanças.
   - Preço único: confirmar se os preços anuais (recorrentes) podem ser usados em `mode: payment`. Se o Stripe recusar, criar 2 preços únicos (Pro R$ 479 e Business R$ 869) nos mesmos produtos e mapeá-los em `stripeTiers.ts` e `stripePrices.ts`.
2. **stripe-webhook**:
   - Em `checkout.session.completed` com `mode === "payment"` e `payment_status === "paid"`, e também em `checkout.session.async_payment_succeeded`, fazer upsert em `subscriptions`: plano pela metadata, `status: active`, `origem: "manual"`, `current_period_start = agora` e `current_period_end = +365 dias`.
   - Se já houver um período ativo, somar os 365 dias a partir do fim atual.
   - Usar `origem "manual"` faz o `check-subscription` respeitar esse plano, porque ele já ignora o Stripe quando há uma assinatura com essa origem e ainda dentro do prazo.
   - O evento `checkout.session.async_payment_succeeded` precisa estar ativo no endpoint do webhook no Stripe. Vou verificar isso e orientar você, se for preciso.
3. **PlanosModal.tsx**: mostrar o selo e o botão Pix só quando o período for anual. Os dois botões usam `abrirLinkExterno`.
4. **Testes**:
   - Pix com preço mensal é recusado.
   - O webhook de Pix pago libera o plano por 365 dias.
   - Renovar antes do fim soma o novo período ao atual.
   - Rodar `tsgo` e `vitest` completos.
