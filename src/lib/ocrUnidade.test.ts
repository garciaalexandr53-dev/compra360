import { describe, it, expect } from "vitest";
import { classificarUnidade, normalizarLinhaNf, descreverConversao } from "./ocrUnidade";

describe("ocrUnidade", () => {
  it("converte embalagem para unidade usando o fator do snapshot", () => {
    const n = normalizarLinhaNf({ unidade: "CX", quantidade: 2, preco_unitario: 46.45 }, 5);
    expect(n.convertido).toBe(true);
    expect(n.quantidade).toBe(10);
    expect(n.preco_unitario).toBeCloseTo(9.29, 2);
    expect(n.unidadeIndefinida).toBe(false);
    expect(descreverConversao(n)).toContain("NF: CX");
  });

  it("mantém valores quando unidade é UN ou fator é 1", () => {
    const un = normalizarLinhaNf({ unidade: "UN", quantidade: 10, preco_unitario: 9.29 }, 5);
    expect(un.convertido).toBe(false);
    expect(un.quantidade).toBe(10);
    expect(un.preco_unitario).toBe(9.29);

    const fator1 = normalizarLinhaNf({ unidade: "CX", quantidade: 3, preco_unitario: 12 }, 1);
    expect(fator1.convertido).toBe(false);
    expect(fator1.quantidade).toBe(3);
    expect(fator1.preco_unitario).toBe(12);
  });

  it("não adivinha quando a unidade não vem na nota", () => {
    const n = normalizarLinhaNf({ unidade: null, quantidade: 2, preco_unitario: 46.45 }, 5);
    expect(n.unidadeIndefinida).toBe(true);
    expect(n.convertido).toBe(false);
    expect(n.quantidade).toBe(2);
    expect(n.preco_unitario).toBe(46.45);
    expect(descreverConversao(n)).toBeNull();
  });

  it("classifica unidades tolerando caixa e pontuação", () => {
    expect(classificarUnidade(" cx ")).toBe("embalagem");
    expect(classificarUnidade("UNI")).toBe("unitaria");
    expect(classificarUnidade("")).toBe("indefinida");
    expect(classificarUnidade("KG")).toBe("indefinida");
  });
});
