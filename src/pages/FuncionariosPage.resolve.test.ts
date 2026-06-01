import { describe, it, expect } from "vitest";
import {
  temObservacaoFator,
  temObservacaoEmb,
  resolveFator,
  resolveEmbalagem,
} from "./FuncionariosPage";

describe("temObservacaoFator", () => {
  it("detecta Fator: 1 como informado pelo funcionário", () => {
    expect(temObservacaoFator("Fator: 1 | Embalagem: un")).toBe(true);
  });
  it("detecta Fator com qualquer dígito", () => {
    expect(temObservacaoFator("Fator: 12")).toBe(true);
  });
  it("retorna false para null/undefined/vazio", () => {
    expect(temObservacaoFator(null)).toBe(false);
    expect(temObservacaoFator(undefined)).toBe(false);
    expect(temObservacaoFator("")).toBe(false);
  });
  it("retorna false para observação sem Fator", () => {
    expect(temObservacaoFator("Embalagem: cx")).toBe(false);
    expect(temObservacaoFator("obs livre do funcionário")).toBe(false);
  });
});

describe("temObservacaoEmb", () => {
  it("detecta Embalagem: un como informada", () => {
    expect(temObservacaoEmb("Fator: 1 | Embalagem: un")).toBe(true);
  });
  it("detecta Embalagem com qualquer token", () => {
    expect(temObservacaoEmb("Embalagem: CX")).toBe(true);
  });
  it("retorna false para null/undefined/vazio", () => {
    expect(temObservacaoEmb(null)).toBe(false);
    expect(temObservacaoEmb(undefined)).toBe(false);
    expect(temObservacaoEmb("")).toBe(false);
  });
  it("retorna false para observação sem Embalagem", () => {
    expect(temObservacaoEmb("Fator: 6")).toBe(false);
  });
});

describe("resolveFator", () => {
  it("preserva fator=1 quando funcionário informou explicitamente, mesmo com cadastro=12", () => {
    expect(resolveFator("Fator: 1 | Embalagem: un", 12)).toBe(1);
  });
  it("usa fator do funcionário quando informado", () => {
    expect(resolveFator("Fator: 6", 12)).toBe(6);
  });
  it("cai no cadastro quando observação não tem Fator", () => {
    expect(resolveFator("Embalagem: cx", 12)).toBe(12);
    expect(resolveFator(null, 24)).toBe(24);
    expect(resolveFator(undefined, 24)).toBe(24);
    expect(resolveFator("texto qualquer", 8)).toBe(8);
  });
  it("retorna 1 como fallback quando não há observação nem cadastro válido", () => {
    expect(resolveFator(null, null)).toBe(1);
    expect(resolveFator(null, 0)).toBe(1);
    expect(resolveFator(undefined, undefined)).toBe(1);
  });
});

describe("resolveEmbalagem", () => {
  it('preserva embalagem "un" do funcionário, mesmo com cadastro="CX"', () => {
    expect(resolveEmbalagem("Fator: 1 | Embalagem: un", "CX")).toBe("UN");
  });
  it("usa embalagem do funcionário quando informada", () => {
    expect(resolveEmbalagem("Embalagem: fardo", "CX|UN")).toBe("FARDO");
  });
  it("cai na primeira embalagem do cadastro quando observação não tem Embalagem", () => {
    expect(resolveEmbalagem("Fator: 6", "CX|UN|FARDO")).toBe("CX");
    expect(resolveEmbalagem(null, "kg")).toBe("KG");
  });
  it('retorna "UNI" como fallback quando não há observação nem cadastro válido', () => {
    expect(resolveEmbalagem(null, null)).toBe("UNI");
    expect(resolveEmbalagem(null, "")).toBe("UNI");
    expect(resolveEmbalagem(null, "   ")).toBe("UNI");
    expect(resolveEmbalagem(undefined, undefined)).toBe("UNI");
  });
  it("sempre retorna em uppercase", () => {
    expect(resolveEmbalagem("Embalagem: cx", null)).toBe("CX");
    expect(resolveEmbalagem(null, "pacote")).toBe("PACOTE");
  });
});
