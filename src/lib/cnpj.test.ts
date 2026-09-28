import { describe, it, expect } from "vitest";
import { validarCNPJ, normalizarRespostaCNPJ } from "./cnpj";

describe("validarCNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("00000000000191")).toBe(true);
  });
  it("recusa dígitos errados e repetidos", () => {
    expect(validarCNPJ("11222333000182")).toBe(false);
    expect(validarCNPJ("11111111111111")).toBe(false);
    expect(validarCNPJ("123")).toBe(false);
  });
});

describe("normalizarRespostaCNPJ", () => {
  it("normaliza campos da BrasilAPI", () => {
    const d = normalizarRespostaCNPJ(
      {
        razao_social: "EMPRESA TESTE LTDA",
        nome_fantasia: "",
        descricao_situacao_cadastral: "ATIVA",
        cep: "87200000",
        descricao_tipo_de_logradouro: "RUA",
        logradouro: "DAS FLORES",
        numero: "10",
        bairro: "CENTRO",
        municipio: "CIANORTE",
        uf: "pr",
      },
      "11222333000181",
    );
    expect(d.ativa).toBe(true);
    expect(d.municipio).toBe("Cianorte");
    expect(d.uf).toBe("PR");
    expect(d.logradouro).toBe("Rua Das Flores");
  });
  it("marca situação inativa", () => {
    const d = normalizarRespostaCNPJ({ descricao_situacao_cadastral: "BAIXADA" }, "x");
    expect(d.ativa).toBe(false);
    expect(d.situacao).toBe("Baixada");
  });
});
