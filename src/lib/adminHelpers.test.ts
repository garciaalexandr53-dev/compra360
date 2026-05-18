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
    expect(normalizarWhatsAppCliente("5511999999999")).toBe("11999999999");  // 13 -> 11
    expect(normalizarWhatsAppCliente("551199999999")).toBe("1199999999");   // 12 -> 10
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

import { situacaoParaMotivo } from "@/lib/adminHelpers";

describe("situacaoParaMotivo", () => {
  it("mapeia trials para trial_expirando", () => {
    expect(situacaoParaMotivo("trial_3d")).toBe("trial_expirando");
    expect(situacaoParaMotivo("trial_7d")).toBe("trial_expirando");
  });
  it("mapeia inativo_15d para risco_churn", () => {
    expect(situacaoParaMotivo("inativo_15d")).toBe("risco_churn");
  });
  it("mapeia sem_uso/boas_vindas para sem_ativacao", () => {
    expect(situacaoParaMotivo("sem_uso_7d")).toBe("sem_ativacao");
    expect(situacaoParaMotivo("boas_vindas")).toBe("sem_ativacao");
  });
  it("defaults para manual quando não houver situação", () => {
    expect(situacaoParaMotivo(undefined)).toBe("manual");
    expect(situacaoParaMotivo(null)).toBe("manual");
  });
});
