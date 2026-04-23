import { describe, it, expect } from "vitest";
import { isLojaAtiva, getDisplayName, formatCNPJ } from "./lojaUtils";

describe("isLojaAtiva", () => {
  it("retorna true quando o id da loja coincide com o id ativo", () => {
    expect(isLojaAtiva("loja-1", "loja-1")).toBe(true);
  });

  it("retorna false quando os ids são diferentes", () => {
    expect(isLojaAtiva("loja-1", "loja-2")).toBe(false);
  });

  it("retorna false quando não há loja ativa", () => {
    expect(isLojaAtiva("loja-1", null)).toBe(false);
    expect(isLojaAtiva("loja-1", undefined)).toBe(false);
    expect(isLojaAtiva("loja-1", "")).toBe(false);
  });
});

describe("getDisplayName", () => {
  it("prioriza nome_fantasia quando presente", () => {
    expect(getDisplayName({ nome: "Apelido", nome_fantasia: "Mercado Central" })).toBe(
      "Mercado Central",
    );
  });

  it("faz fallback para nome quando nome_fantasia está vazio ou nulo", () => {
    expect(getDisplayName({ nome: "Apelido", nome_fantasia: null })).toBe("Apelido");
    expect(getDisplayName({ nome: "Apelido", nome_fantasia: "  " })).toBe("Apelido");
  });

  it("retorna string vazia quando ambos são vazios", () => {
    expect(getDisplayName({ nome: "", nome_fantasia: null })).toBe("");
  });
});

describe("formatCNPJ", () => {
  it("formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX", () => {
    expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("aceita entrada parcial sem quebrar", () => {
    expect(formatCNPJ("123")).toBe("12.3");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatCNPJ("abc12.345/678")).toBe("12.345.678");
  });
});
