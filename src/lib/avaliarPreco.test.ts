import { describe, it, expect } from "vitest";
import { avaliarPreco } from "./avaliarPreco";

describe("avaliarPreco", () => {
  it("alerta quando o preço está muito acima da mediana", () => {
    const r = avaliarPreco(20, 10, "global");
    expect(r.alerta).toBe(true);
    expect(r.motivo).toBe("mediana");
    expect(r.fonte).toBe("global");
    expect(r.desvio).toBeCloseTo(1);
  });

  it("alerta quando o fornecedor esquece um dígito (100x menor)", () => {
    const r = avaliarPreco(0.93, 93, "global");
    expect(r.alerta).toBe(true);
    expect(r.motivo).toBe("mediana");
  });

  it("não alerta dentro da tolerância de 20%", () => {
    expect(avaliarPreco(11.5, 10, "comprador").alerta).toBe(false);
    expect(avaliarPreco(8.5, 10, "comprador").alerta).toBe(false);
  });

  it("sem referência cai na faixa fixa antiga", () => {
    expect(avaliarPreco(0.3, null).alerta).toBe(true);
    expect(avaliarPreco(1500, null).alerta).toBe(true);
    const ok = avaliarPreco(46.45, null);
    expect(ok.alerta).toBe(false);
    expect(ok.motivo).toBe("faixa_fixa");
  });

  it("ignora preços vazios ou zero", () => {
    expect(avaliarPreco(0, 10).alerta).toBe(false);
    expect(avaliarPreco(null, 10).alerta).toBe(false);
  });
});
