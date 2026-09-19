import { describe, it, expect } from "vitest";
import { maskTelefone, maskCNPJ, isTelefoneValido, isCNPJValido, formatTelefone } from "./masks";

describe("maskTelefone", () => {
  it("formats 11 digits as mobile", () => {
    expect(maskTelefone("11987654321")).toBe("(11) 98765-4321");
  });
  it("formats 10 digits as landline", () => {
    expect(maskTelefone("1133334444")).toBe("(11) 3333-4444");
  });
  it("handles partial input", () => {
    expect(maskTelefone("11")).toBe("(11");
    expect(maskTelefone("119")).toBe("(11) 9");
  });
});

describe("maskCNPJ", () => {
  it("formats full CNPJ", () => {
    expect(maskCNPJ("12345678000199")).toBe("12.345.678/0001-99");
  });
});

describe("validators", () => {
  it("validates telefone", () => {
    expect(isTelefoneValido("11987654321")).toBe(true);
    expect(isTelefoneValido("1133334444")).toBe(true);
    expect(isTelefoneValido("123")).toBe(false);
    expect(isTelefoneValido("")).toBe(true);
  });
  it("validates CNPJ", () => {
    expect(isCNPJValido("12345678000199")).toBe(true);
    expect(isCNPJValido("123")).toBe(false);
    expect(isCNPJValido("")).toBe(true);
  });
});

describe("formatTelefone (prefill de formulários)", () => {
  it("remove o código do país 55 sem cortar dígitos", () => {
    expect(formatTelefone("5544999447117")).toBe("(44) 99944-7117");
    expect(formatTelefone("554433334444")).toBe("(44) 3333-4444");
  });
  it("mantém números já corretos", () => {
    expect(formatTelefone("44999447117")).toBe("(44) 99944-7117");
    expect(formatTelefone("(44) 99944-7117")).toBe("(44) 99944-7117");
  });
  it("devolve o texto original quando não reconhece", () => {
    expect(formatTelefone("123")).toBe("123");
    expect(formatTelefone(null)).toBe("");
  });
});
