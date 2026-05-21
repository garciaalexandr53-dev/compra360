// Stripe price IDs de produção (live)
export const STRIPE_PRICES = {
  pro_mensal: "price_1TZYctRsAnnCWikuFoi74yDA",
  pro_anual: "price_1TZYrmRsAnnCWikupP0T8XEL",
  business_mensal: "price_1TZYusRsAnnCWikuRWNE0cJ6",
  business_anual: "price_1TZYvrRsAnnCWikueV1dORha",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;
export type PlanoPago = "pro" | "business";
export type Periodo = "mensal" | "anual";

/**
 * Retorna o priceId do Stripe correspondente ao plano + período escolhido
 * no toggle Mensal/Anual.
 */
export function getStripePriceId(plano: PlanoPago, periodo: Periodo): string {
  if (plano === "pro") {
    return periodo === "mensal" ? STRIPE_PRICES.pro_mensal : STRIPE_PRICES.pro_anual;
  }
  return periodo === "mensal" ? STRIPE_PRICES.business_mensal : STRIPE_PRICES.business_anual;
}
