import { describe, it, expect } from "vitest";
import { normalizeNomeCotacao, isDuplicadoNaCotacao } from "./cotacaoDedup";

describe("cotacaoDedup — duas travas", () => {
  const rows = [
    { nome: "Sal Grosso Para Churrasco Uniao 1kg", produto_id: "p1", catalogo_mestre_id: null },
    { nome: "Creme de Leite Mococa 200g", produto_id: null, catalogo_mestre_id: "c1" },
  ];

  it("normaliza acentos, caixa e pontuação", () => {
    expect(normalizeNomeCotacao("Sal Grosso para Churrasco União 1kg")).toBe(
      "sal grosso para churrasco uniao 1kg",
    );
  });

  it("trava 1: bloqueia mesmo produto local pelo id", () => {
    expect(isDuplicadoNaCotacao(rows, { nome: "Outro", produtoId: "p1" })).toBe(true);
  });

  it("trava 1: bloqueia mesmo item do catálogo pelo id", () => {
    expect(isDuplicadoNaCotacao(rows, { nome: "Outro", catalogoMestreId: "c1" })).toBe(true);
  });

  it("trava 2: bloqueia item do catálogo com o mesmo nome de um item local", () => {
    expect(
      isDuplicadoNaCotacao(rows, {
        nome: "Sal Grosso para Churrasco Uniao 1kg",
        catalogoMestreId: "c99",
      }),
    ).toBe(true);
  });

  it("permite produto realmente diferente", () => {
    expect(isDuplicadoNaCotacao(rows, { nome: "Sal Refinado Sartori 1kg", produtoId: "p9" })).toBe(
      false,
    );
  });

  it("nome vazio não bloqueia quando os ids são novos", () => {
    expect(isDuplicadoNaCotacao(rows, { nome: "", produtoId: "p9" })).toBe(false);
  });
});
