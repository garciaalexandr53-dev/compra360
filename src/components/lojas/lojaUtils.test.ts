import { describe, it, expect } from "vitest";
import { isLojaAtiva, getDisplayName, formatCNPJ, formatCEP, formatUF, formatCidadeUF } from "./lojaUtils";

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

describe("formatCEP", () => {
  it("aplica máscara 00000-000", () => {
    expect(formatCEP("05127174")).toBe("05127-174");
  });
  it("ignora caracteres não numéricos e limita a 8 dígitos", () => {
    expect(formatCEP("abc0512717499")).toBe("05127-174");
  });
});

describe("formatUF", () => {
  it("mantém 2 letras em maiúsculas", () => {
    expect(formatUF("sp")).toBe("SP");
    expect(formatUF("s1p2x")).toBe("SP");
  });
});

describe("formatCidadeUF", () => {
  it("junta cidade e UF", () => {
    expect(formatCidadeUF({ cidade: "São Paulo", uf: "SP" })).toBe("São Paulo - SP");
  });
  it("usa só o que existir", () => {
    expect(formatCidadeUF({ cidade: "São Paulo", uf: null })).toBe("São Paulo");
    expect(formatCidadeUF({ cidade: null, uf: null })).toBe("");
  });
});
