import { describe, it, expect } from "vitest";
import { pixPriceFor, calcularPeriodoPix } from "../../supabase/functions/_shared/pixAnual";
import { STRIPE_PRICES } from "./stripePrices";

describe("Pix somente no anual", () => {
  it("recusa Pix nos planos mensais", () => {
    expect(pixPriceFor(STRIPE_PRICES.pro_mensal)).toBeNull();
    expect(pixPriceFor(STRIPE_PRICES.business_mensal)).toBeNull();
  });
  it("aceita Pix nos anuais com o preço à vista correto", () => {
    expect(pixPriceFor(STRIPE_PRICES.pro_anual)).toBe("price_1UO0PqRsAnnCWiku6fMIV4sP");
    expect(pixPriceFor(STRIPE_PRICES.business_anual)).toBe("price_1UO0PvRsAnnCWikuQY95hoRx");
  });
  it("Pix pago libera 365 dias", () => {
    const p = calcularPeriodoPix(new Date("2026-10-07T00:00:00Z"), null);
    expect(p.fim).toBe("2027-10-07T00:00:00.000Z");
  });
  it("renovar antes do fim soma ao período atual", () => {
    const p = calcularPeriodoPix(new Date("2026-10-07T00:00:00Z"), "2026-12-01T00:00:00Z");
    expect(p.fim).toBe("2027-12-01T00:00:00.000Z");
  });
});
