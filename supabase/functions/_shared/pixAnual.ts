// Pix à vista: só para planos anuais. Preços avulsos (one_time) no Stripe.
export const PIX_PRICES: Record<string, "pro" | "business"> = {
  price_1UO0PqRsAnnCWiku6fMIV4sP: "pro", // Pro Anual - Pix R$ 479
  price_1UO0PvRsAnnCWikuQY95hoRx: "business", // Business Anual - Pix R$ 869
};

// Preço anual recorrente (cartão) -> preço Pix equivalente
export const PIX_POR_ANUAL: Record<string, string> = {
  price_1TZYrmRsAnnCWikupP0T8XEL: "price_1UO0PqRsAnnCWiku6fMIV4sP",
  price_1TZYvrRsAnnCWikueV1dORha: "price_1UO0PvRsAnnCWikuQY95hoRx",
};

/** Retorna o preço Pix para um priceId anual, ou null se não for anual (Pix recusado). */
export const pixPriceFor = (priceId: string): string | null =>
  PIX_POR_ANUAL[priceId] ?? (PIX_PRICES[priceId] ? priceId : null);

const ANO_MS = 365 * 24 * 60 * 60 * 1000;

/** Novo período: 365 dias a partir de agora, ou do fim atual se ainda estiver ativo. */
export function calcularPeriodoPix(
  agora: Date,
  fimAtual?: string | null,
): { inicio: string; fim: string } {
  const fimMs = fimAtual ? new Date(fimAtual).getTime() : NaN;
  const base = Number.isFinite(fimMs) && fimMs > agora.getTime() ? fimMs : agora.getTime();
  return { inicio: agora.toISOString(), fim: new Date(base + ANO_MS).toISOString() };
}
