// Fonte única de verdade do mapeamento Stripe -> plano interno.

// Stripe product_id -> nome do plano interno
export const TIERS_BY_PRODUCT: Record<string, string> = {
  // Produção (live)
  prod_UYfyII4JC0pj09: "pro", // Compra360 Pro (mensal)
  prod_UYgEdk6iT58nVq: "pro", // Compra360 Pro (anual)
  prod_UYgHaqHI56ZhCg: "business", // Compra360 Business (mensal)
  prod_UYgIdiTdFac5BR: "business", // Compra360 Business (anual)
  // Teste (mantidos para não quebrar assinaturas antigas)
  prod_UJS4YQNTiMkNEO: "pro",
  prod_UJS4CAxWQ3djwF: "business",
};

// Stripe price_id -> nome do plano interno (fallback)
export const TIERS_BY_PRICE: Record<string, string> = {
  price_1TZYctRsAnnCWikuFoi74yDA: "pro",
  price_1TZYrmRsAnnCWikupP0T8XEL: "pro",
  price_1TZYusRsAnnCWikuRWNE0cJ6: "business",
  price_1TZYvrRsAnnCWikueV1dORha: "business",
  price_1TKpAoRqa8H38ghzHoJp4PWR: "pro",
  price_1TKpAORqa8H38ghzur73xJl8: "business",
  price_1TYyddRqa8H38ghzos78Tvwq: "pro",
  price_1TYykORqa8H38ghznsu67izE: "business",
};

export const resolveTier = (
  productId?: string | null,
  priceId?: string | null,
): string | null =>
  (productId && TIERS_BY_PRODUCT[productId]) ||
  (priceId && TIERS_BY_PRICE[priceId]) ||
  null;

// Stripe moveu current_period_* para os itens da assinatura nas versões novas
export const unixToIso = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;

export const periodStart = (sub: any): string | null =>
  unixToIso(sub?.current_period_start ?? sub?.items?.data?.[0]?.current_period_start);

export const periodEnd = (sub: any): string | null =>
  unixToIso(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end);

// Status do Stripe -> enum subscription_status do banco
export const mapStatus = (status: string): "active" | "past_due" | "canceled" | "trialing" => {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
};
