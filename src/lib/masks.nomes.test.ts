import { describe, it, expect } from "vitest";
import { formatNomeEmpresa, formatNomePessoa, formatNomeLoja } from "./masks";

describe("padronização de nomes", () => {
  it("empresa em maiúsculo", () => {
    expect(formatNomeEmpresa("atacadão")).toBe("ATACADÃO");
    expect(formatNomeEmpresa("  arte   mix atacado ")).toBe("ARTE MIX ATACADO");
    expect(formatNomeEmpresa(null)).toBe("");
  });
  it("pessoa em title case com preposições", () => {
    expect(formatNomePessoa("LULA")).toBe("Lula");
    expect(formatNomePessoa("joao da silva")).toBe("Joao da Silva");
    expect(formatNomePessoa("valdenir  de  souza")).toBe("Valdenir de Souza");
  });
  it("loja em title case preservando separadores", () => {
    expect(formatNomeLoja("BRAND VAREJÃO - CIANORTE")).toBe("Brand Varejão - Cianorte");
    expect(formatNomeLoja("mercado moura")).toBe("Mercado Moura");
    expect(formatNomeLoja("São Luiz")).toBe("São Luiz");
  });
});
