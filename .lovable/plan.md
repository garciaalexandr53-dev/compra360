# Corrigir "Total pago estimado" no perfil do cliente

## O que está acontecendo (verificado)

O valor não é o que o cliente pagou de fato — é uma estimativa calculada no front, e a conta parte da data errada.

A estimativa usa a data de início do **ciclo atual** da assinatura. Para esse cliente, o ciclo atual começou em 23/07/2026 e vence em 23/08/2026. Como isso dá menos de um mês, a conta arredonda para 1 mês e mostra 1 × R$ 97,00 = R$ 97,00 — mesmo o cliente já tendo 2 faturas pagas (23/06 e 23/07), ou seja R$ 194,00 reais.

Resumindo: a estimativa nunca soma o histórico de pagamentos; ela só multiplica o preço do plano por um número de meses derivado de uma data que se move a cada renovação.

## Correção proposta

Trocar a estimativa por dados reais de faturamento, que já existem na integração de pagamentos:

1. **Total realmente pago**: somar as faturas pagas do cliente na integração de pagamentos, sem limite de janela de tempo. O rótulo passa a ser "Total pago" (não mais "estimado").
2. **Contexto no perfil**: mostrar também quantas faturas pagas compõem o valor e a data da última fatura paga, para o total ser auditável de olho.
3. **Próxima cobrança**: exibir a data do próximo vencimento (23/08 no caso) e o valor previsto, separado do total pago — hoje os dois conceitos se misturam na cabeça de quem lê.
4. **Sem dado de pagamento**: quando o cliente não tem faturas (trial, plano free, plano concedido manualmente pelo admin), mostrar "Nenhum pagamento registrado" em vez de um número inventado.

## Detalhes técnicos

- Estender a função `stripe-dados` com um modo por cliente: parâmetro `customer_email` (ou `customer_id`) que retorna `{ total_pago, faturas_pagas, ultima_fatura_paga_em, proxima_cobranca_em, proxima_cobranca_valor }`, paginando `invoices.list` para cobrir todo o histórico e somando `amount_paid` das faturas com status `paid`. Mantém o gate admin já existente na função.
- Em `src/components/admin/ClienteDetalhesSheet.tsx`: remover a função local `calcularTotalPago` e o uso de `plan_price_monthly`/`subscription_started_at` para esse cálculo, e substituir por uma query ao novo modo da função, com estado de carregando e fallback "—" em caso de erro.
- `admin_get_cliente_detalhes` continua como está; `plan_price_monthly` segue disponível para o valor previsto da próxima cobrança.
- Layout responsivo verificado em 360px e desktop.
