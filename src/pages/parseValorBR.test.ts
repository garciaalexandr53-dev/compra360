import { describe, it, expect } from "vitest";
import { parseValorBR } from "./ParceiroPage";
describe("parseValorBR", () => {
  it("lê vírgula decimal", () => expect(parseValorBR("1.250,50")).toBe(1250.5));
  it("lê ponto decimal", () => expect(parseValorBR("300.5")).toBe(300.5));
  it("vazio vira null", () => expect(parseValorBR("")).toBeNull());
  it("ponto de milhar sem vírgula", () => expect(parseValorBR("1.500")).toBe(1500));
  it("vários pontos de milhar", () => expect(parseValorBR("1.250.000")).toBe(1250000));
});
