import { describe, it, expect } from "vitest";
import {
  computeKPIs,
  buildFornecedorRanking,
  buildProdutoVariacao,
  computeEconomia,
  type InsightCotacao,
  type InsightRow,
} from "./historicoInsights";

const cot = (id: string, total: number): InsightCotacao => ({
  id,
  nome: `Cot ${id}`,
  created_at: `2025-05-0${id}T10:00:00Z`,
  status: "finalizada",
  loja_nome: "Loja A",
  produtos_count: 1,
  fornecedores_count: 1,
  total_pedido: total,
});

const row = (overrides: Partial<InsightRow> = {}): InsightRow => ({
  cotacaoId: "1",
  cotacaoNome: "Cot 1",
  date: "2025-05-01T10:00:00Z",
  produtoNome: "Arroz",
  embalagem: "PCT",
  fator: 5,
  qtd: 10,
  fornecedor: "Forn A",
  precoUnit: 4,
  total: 200, // 10 * 5 * 4
  ...overrides,
});

describe("historicoInsights", () => {
  it("computeKPIs agrega total, ticket médio e únicos", () => {
    const cotacoes = [cot("1", 200), cot("2", 300)];
    const rows = [
      row({ cotacaoId: "1", produtoNome: "Arroz", fornecedor: "Forn A", total: 200 }),
      row({ cotacaoId: "2", produtoNome: "Feijão", fornecedor: "Forn B", total: 300 }),
    ];
    const k = computeKPIs(cotacoes, rows, 50);
    expect(k.cotacoes).toBe(2);
    expect(k.totalGeral).toBe(500);
    expect(k.ticketMedio).toBe(250);
    expect(k.produtosUnicos).toBe(2);
    expect(k.fornecedoresUnicos).toBe(2);
    expect(k.economiaEstimada).toBe(50);
  });

  it("buildFornecedorRanking ordena por total ganho e calcula taxa sobre itens cotados", () => {
    const rows = [
      row({ cotacaoId: "1", fornecedor: "A", total: 100 }),
      row({ cotacaoId: "1", fornecedor: "B", total: 50 }),
      row({ cotacaoId: "2", fornecedor: "A", total: 200 }),
    ];
    const r = buildFornecedorRanking(rows, new Map([["A", 4], ["B", 2]]));
    expect(r[0].nome).toBe("A");
    expect(r[0].vitorias).toBe(2);
    expect(r[0].totalCotacoes).toBe(2);
    expect(r[0].itensCotados).toBe(4);
    expect(r[0].taxa).toBe(50);
    expect(r[0].totalGanho).toBe(300);
    expect(r[1].nome).toBe("B");
    expect(r[1].taxa).toBe(50);
  });

  it("buildFornecedorRanking limita a taxa a 100% e devolve null sem denominador", () => {
    const rows = [
      row({ cotacaoId: "1", fornecedor: "A", total: 100 }),
      row({ cotacaoId: "2", fornecedor: "A", total: 100 }),
    ];
    expect(buildFornecedorRanking(rows, new Map([["A", 1]]))[0].taxa).toBe(100);
    expect(buildFornecedorRanking(rows)[0].taxa).toBeNull();
  });


  it("buildProdutoVariacao calcula min/max/médio/variação%", () => {
    const rows = [
      row({ produtoNome: "Arroz", precoUnit: 4, date: "2025-05-01T00:00:00Z" }),
      row({ produtoNome: "Arroz", precoUnit: 5, date: "2025-05-02T00:00:00Z" }),
      row({ produtoNome: "Arroz", precoUnit: 6, date: "2025-05-03T00:00:00Z", fornecedor: "Forn C" }),
    ];
    const v = buildProdutoVariacao(rows);
    expect(v).toHaveLength(1);
    expect(v[0].precoMin).toBe(4);
    expect(v[0].precoMax).toBe(6);
    expect(v[0].precoMedio).toBe(5);
    expect(v[0].variacaoPct).toBeCloseTo(50, 1); // (6-4)/4 = 50%
    expect(v[0].ultimoPreco).toBe(6);
    expect(v[0].ultimoFornecedor).toBe("Forn C");
  });

  it("computeEconomia soma diferença qtd × fator × (média - winner)", () => {
    const r = row({ qtd: 10, fator: 5, precoUnit: 4 });
    // Média = (4+5+7)/3 = 5.333… → economia = (5.333-4) * 10 * 5 ≈ 66,67
    const economia = computeEconomia([r], () => [4, 5, 7]);
    expect(economia).toBeCloseTo(66.6667, 3);
  });

  it("computeEconomia ignora linhas com apenas 1 preço", () => {
    const r = row();
    expect(computeEconomia([r], () => [4])).toBe(0);
  });
});
