import { describe, it, expect } from "vitest";
import { mapCandidato, mapCandidatos, filtrarCandidatos, rotuloOrigem, CandidatoRow } from "./catalogoCandidatos";

const row = (over: Partial<CandidatoRow> = {}): CandidatoRow => ({
  ean: "7891234567895",
  nome: " Leite de Coco 200ml ",
  embalagem: "CX",
  fator_embalagem: 24,
  origens: ["produtos"],
  ocorrencias: 3,
  ultimo_em: "2026-08-20T10:00:00Z",
  ...over,
});

describe("mapCandidato", () => {
  it("normaliza nome, embalagem e origem", () => {
    const c = mapCandidato(row());
    expect(c.nome).toBe("Leite de Coco 200ml");
    expect(c.embalagem).toBe("CX");
    expect(c.fator_embalagem).toBe(24);
    expect(c.origens).toEqual(["Catálogo local"]);
    expect(c.ocorrencias).toBe(3);
  });

  it("usa fator padrão da embalagem quando ausente", () => {
    expect(mapCandidato(row({ fator_embalagem: null })).fator_embalagem).toBe(12);
    expect(mapCandidato(row({ embalagem: null, fator_embalagem: 0 })).fator_embalagem).toBe(1);
  });

  it("cai para UNI quando a embalagem não é aceita no catálogo", () => {
    expect(mapCandidato(row({ embalagem: "½DZ" })).embalagem).toBe("UNI");
  });

  it("rotula as duas origens sem repetir", () => {
    const c = mapCandidato(row({ origens: ["produtos", "itens_faltantes", "produtos"] }));
    expect(c.origens).toEqual(["Catálogo local", "App Funcionários"]);
  });

  it("mantém origem desconhecida como veio", () => {
    expect(rotuloOrigem("outra")).toBe("outra");
  });
});

describe("mapCandidatos", () => {
  it("deduplica por EAN e ignora linhas sem EAN", () => {
    const out = mapCandidatos([row(), row({ nome: "Duplicado" }), row({ ean: "" }), row({ ean: "12345678" })]);
    expect(out.map((c) => c.ean)).toEqual(["7891234567895", "12345678"]);
    expect(out[0].nome).toBe("Leite de Coco 200ml");
  });
});

describe("filtrarCandidatos", () => {
  const itens = mapCandidatos([row(), row({ ean: "12345678", nome: "Arroz 5kg" })]);

  it("busca por nome sem diferenciar caixa", () => {
    expect(filtrarCandidatos(itens, "arroz").map((c) => c.ean)).toEqual(["12345678"]);
  });

  it("busca por trecho do EAN", () => {
    expect(filtrarCandidatos(itens, "789123").map((c) => c.ean)).toEqual(["7891234567895"]);
  });

  it("sem termo devolve tudo", () => {
    expect(filtrarCandidatos(itens, "  ")).toHaveLength(2);
  });
});
