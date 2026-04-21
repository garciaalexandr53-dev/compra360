import { describe, it, expect } from "vitest";
import { PLAN_PRICE_NUMERIC } from "@/lib/planPrices";
import type { Cliente } from "@/lib/adminHelpers";

/**
 * Smoke test for the MRR computation used in AdminPage.
 *
 * AdminPage derives `mrrCalculado` directly from the deduplicated client list:
 *   clientes
 *     .filter((c) => c.plan_status === "active" && (c.plan_name === "pro" || c.plan_name === "business"))
 *     .reduce((s, c) => s + (PLAN_PRICE_NUMERIC[c.plan_name] || 0), 0);
 *
 * We replicate the exact reducer here to guarantee it stays aligned with
 * the centralized PLAN_PRICE_NUMERIC values (planPrices.ts).
 */
function computeMrr(clientes: Pick<Cliente, "plan_name" | "plan_status">[]): number {
  return clientes
    .filter(
      (c) =>
        c.plan_status === "active" &&
        (c.plan_name === "pro" || c.plan_name === "business"),
    )
    .reduce((s, c) => s + (PLAN_PRICE_NUMERIC[c.plan_name] || 0), 0);
}

describe("AdminPage — MRR computation", () => {
  it("uses the centralized PLAN_PRICE_NUMERIC values", () => {
    expect(PLAN_PRICE_NUMERIC.free).toBe(0);
    expect(PLAN_PRICE_NUMERIC.pro).toBe(49.9);
    expect(PLAN_PRICE_NUMERIC.business).toBe(97);
  });

  it("returns 0 when there are no clients", () => {
    expect(computeMrr([])).toBe(0);
  });

  it("ignores free, trialing, canceled and past_due clients", () => {
    const clientes = [
      { plan_name: "free", plan_status: "active" },
      { plan_name: "pro", plan_status: "trialing" },
      { plan_name: "business", plan_status: "canceled" },
      { plan_name: "pro", plan_status: "past_due" },
      { plan_name: "business", plan_status: "incomplete" },
      { plan_name: "pro", plan_status: "incomplete_expired" },
      { plan_name: "business", plan_status: "unpaid" },
    ] as Pick<Cliente, "plan_name" | "plan_status">[];
    expect(computeMrr(clientes)).toBe(0);
  });

  it("nunca inclui clientes com plan_status diferente de active no MRR", () => {
    const allNonActiveStatuses = [
      "trialing",
      "canceled",
      "past_due",
      "incomplete",
      "incomplete_expired",
      "unpaid",
    ] as const;

    // Cria um cliente pro/business para cada status não-ativo
    const clientes = allNonActiveStatuses.flatMap((status) => [
      { plan_name: "pro" as const, plan_status: status },
      { plan_name: "business" as const, plan_status: status },
    ]);

    // Nenhum deve contribuir para o MRR
    expect(computeMrr(clientes)).toBe(0);

    // Verifica que o MRR só aumenta quando status é "active"
    const activeClientes = [
      { plan_name: "pro", plan_status: "active" },
      { plan_name: "business", plan_status: "active" },
    ] as Pick<Cliente, "plan_name" | "plan_status">[];

    expect(computeMrr(activeClientes)).toBeCloseTo(49.9 + 97, 2);
  });

  it("sums only active pro and business plans", () => {
    const clientes = [
      { plan_name: "pro", plan_status: "active" }, // 49.90
      { plan_name: "business", plan_status: "active" }, // 97
      { plan_name: "pro", plan_status: "active" }, // 49.90
      { plan_name: "free", plan_status: "active" }, // ignored
      { plan_name: "business", plan_status: "trialing" }, // ignored
    ] as Pick<Cliente, "plan_name" | "plan_status">[];
    // 49.90 + 97 + 49.90 = 196.80
    expect(computeMrr(clientes)).toBeCloseTo(196.8, 2);
  });

  it("matches the expected total for a single pro and a single business", () => {
    const clientes = [
      { plan_name: "pro", plan_status: "active" },
      { plan_name: "business", plan_status: "active" },
    ] as Pick<Cliente, "plan_name" | "plan_status">[];
    expect(computeMrr(clientes)).toBeCloseTo(49.9 + 97, 2);
  });
});
