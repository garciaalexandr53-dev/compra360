import { describe, it, expect } from "vitest";
import { normalizarWhatsAppCliente } from "./adminHelpers";

describe("normalizarWhatsAppCliente", () => {
  it("retorna null para valores nulos ou vazios", () => {
    expect(normalizarWhatsAppCliente(null)).toBeNull();
    expect(normalizarWhatsAppCliente(undefined)).toBeNull();
    expect(normalizarWhatsAppCliente("")).toBeNull();
  });

  it("remove todos os caracteres não numéricos", () => {
    expect(normalizarWhatsAppCliente("(11) 99999-9999")).toBe("11999999999");
    expect(normalizarWhatsAppCliente("+55 (11) 99999-9999")).toBe("11999999999");
    expect(normalizarWhatsAppCliente("11.99999-9999")).toBe("11999999999");
    expect(normalizarWhatsAppCliente("  11 99999 9999  ")).toBe("11999999999");
  });

  it("remove o DDI 55 quando o número tem 12 ou 13 dígitos", () => {
    expect(normalizarWhatsAppCliente("5511999999999")).toBe("11999999999"); // 13 dígitos -> 11
    expect(normalizarWhatsAppCliente("551199999999")).toBe("11999999999");  // 12 dígitos -> 10
    expect(normalizarWhatsAppCliente("+55 (11) 99999-9999")).toBe("11999999999");
  });

  it("não remove 55 quando não é DDI (menos de 12 dígitos)", () => {
    expect(normalizarWhatsAppCliente("5599999999")).toBe("5599999999"); // 10 dígitos, mantém
    expect(normalizarWhatsAppCliente("559999999")).toBeNull();         // 9 dígitos, inválido
  });

  it("não remove 55 do meio do número", () => {
    expect(normalizarWhatsAppCliente("119559999999")).toBe("119559999999");
  });

  it("aceita números com 10 dígitos (fixo com DDD)", () => {
    expect(normalizarWhatsAppCliente("1133334444")).toBe("1133334444");
  });

  it("aceita números com 11 dígitos (celular com DDD + 9)", () => {
    expect(normalizarWhatsAppCliente("11999999999")).toBe("11999999999");
  });

  it("retorna null quando o número tem menos de 10 dígitos", () => {
    expect(normalizarWhatsAppCliente("999999999")).toBeNull();  // 9 dígitos
    expect(normalizarWhatsAppCliente("1234567")).toBeNull();   // 7 dígitos
    expect(normalizarWhatsAppCliente("55")).toBeNull();        // 2 dígitos
  });

  it("funciona com DDI de outros países (não remove 55)", () => {
    expect(normalizarWhatsAppCliente("14155551234")).toBe("14155551234"); // EUA: 11 dígitos
  });
});
