import { describe, it, expect } from "vitest";
import { STRIPE_PRICES, getStripePriceId } from "./stripePrices";

describe("getStripePriceId — toggle Mensal/Anual", () => {
  describe("plano Pro", () => {
    it("retorna price_id mensal quando toggle = mensal", () => {
      expect(getStripePriceId("pro", "mensal")).toBe(STRIPE_PRICES.pro_mensal);
    });

    it("retorna price_id anual quando toggle = anual", () => {
      expect(getStripePriceId("pro", "anual")).toBe(STRIPE_PRICES.pro_anual);
    });

    it("mensal e anual retornam price_ids diferentes", () => {
      expect(getStripePriceId("pro", "mensal")).not.toBe(
        getStripePriceId("pro", "anual"),
      );
    });
  });

  describe("plano Business", () => {
    it("retorna price_id mensal quando toggle = mensal", () => {
      expect(getStripePriceId("business", "mensal")).toBe(
        STRIPE_PRICES.business_mensal,
      );
    });

    it("retorna price_id anual quando toggle = anual", () => {
      expect(getStripePriceId("business", "anual")).toBe(
        STRIPE_PRICES.business_anual,
      );
    });

    it("mensal e anual retornam price_ids diferentes", () => {
      expect(getStripePriceId("business", "mensal")).not.toBe(
        getStripePriceId("business", "anual"),
      );
    });
  });

  it("não mistura price_ids entre Pro e Business", () => {
    const ids = [
      getStripePriceId("pro", "mensal"),
      getStripePriceId("pro", "anual"),
      getStripePriceId("business", "mensal"),
      getStripePriceId("business", "anual"),
    ];
    // Todos os 4 price_ids devem ser únicos
    expect(new Set(ids).size).toBe(4);
  });

  it("usa os price_ids de produção definidos em STRIPE_PRICES", () => {
    expect(getStripePriceId("pro", "mensal")).toBe("price_1TZYctRsAnnCWikuFoi74yDA");
    expect(getStripePriceId("pro", "anual")).toBe("price_1TZYrmRsAnnCWikupP0T8XEL");
    expect(getStripePriceId("business", "mensal")).toBe("price_1TZYusRsAnnCWikuRWNE0cJ6");
    expect(getStripePriceId("business", "anual")).toBe("price_1TZYvrRsAnnCWikueV1dORha");
  });
});
