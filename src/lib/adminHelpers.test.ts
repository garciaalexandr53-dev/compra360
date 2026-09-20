import { describe, it, expect } from "vitest";
import { PASTAS_FORNECEDOR, pastasDisponiveis, podePularCnpj } from "./adminHelpers";

describe("pastasDisponiveis", () => {
  it("não oferece Bebidas para geral ou bebidas", () => {
    expect(pastasDisponiveis("geral")).not.toContain("Bebidas");
    expect(pastasDisponiveis("bebidas")).not.toContain("Bebidas");
    expect(pastasDisponiveis(null)).toEqual(PASTAS_FORNECEDOR);
  });

  it("oferece Bebidas apenas para especializado", () => {
    const lista = pastasDisponiveis("especializado");
    expect(lista).toContain("Bebidas");
    expect(lista.length).toBe(PASTAS_FORNECEDOR.length + 1);
  });
});

describe("podePularCnpj", () => {
  it("permite as 3 primeiras tentativas e bloqueia depois", () => {
    expect(podePularCnpj(0)).toBe(true);
    expect(podePularCnpj(2)).toBe(true);
    expect(podePularCnpj(3)).toBe(false);
    expect(podePularCnpj(9)).toBe(false);
    expect(podePularCnpj(null)).toBe(true);
  });
});
