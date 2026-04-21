// Preços centralizados dos planos Compra360
// Edite aqui para atualizar em todos os lugares: LandingPage, PlanosModal, AdminPage, emails

export const PLAN_PRICES = {
  free: {
    monthly: 0,
    display: "R$ 0",
    note: "/mês",
  },
  pro: {
    monthly: 49.9,
    display: "R$ 49,90",
    note: "/mês",
  },
  business: {
    monthly: 97,
    display: "R$ 97",
    note: "/mês",
    originalDisplay: "R$ 149", // preço promocional
  },
} as const;

// Preço numérico para cálculos (MRR, etc)
export const PLAN_PRICE_NUMERIC: Record<string, number> = {
  free: PLAN_PRICES.free.monthly,
  pro: PLAN_PRICES.pro.monthly,
  business: PLAN_PRICES.business.monthly,
};

// Helper para formatar preço em reais
export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

// Helper para obter label do plano
export function getPlanPriceDisplay(planKey: keyof typeof PLAN_PRICES): string {
  const plan = PLAN_PRICES[planKey];
  return `${plan.display}${plan.note}`;
}
