import { describe, it, expect } from "vitest";
import { ehPrimeiraCotacaoComFornecedores } from "./primeiroPasso";

describe("ehPrimeiraCotacaoComFornecedores", () => {
  it("mostra o convite quando há fornecedores e nenhuma cotação anterior", () => {
    expect(ehPrimeiraCotacaoComFornecedores({ totalFornecedores: 3, temCotacaoAnterior: false, itensFaltantes: 0 })).toBe(true);
  });
  it("não mostra sem fornecedores", () => {
    expect(ehPrimeiraCotacaoComFornecedores({ totalFornecedores: 0, temCotacaoAnterior: false, itensFaltantes: 0 })).toBe(false);
  });
  it("não mostra para quem já fez cotação", () => {
    expect(ehPrimeiraCotacaoComFornecedores({ totalFornecedores: 3, temCotacaoAnterior: true, itensFaltantes: 0 })).toBe(false);
  });
  it("faltas da equipe têm prioridade", () => {
    expect(ehPrimeiraCotacaoComFornecedores({ totalFornecedores: 3, temCotacaoAnterior: false, itensFaltantes: 2 })).toBe(false);
  });
});
