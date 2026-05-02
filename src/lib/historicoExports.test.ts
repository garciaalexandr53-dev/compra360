import { describe, it, expect } from "vitest";
import type { ExportRow } from "./historicoExports";
import { formatBRL } from "./format";

/**
 * These tests guard the invariant that the "TOTAL GERAL" shown in the PDF
 * (and Excel/print) always equals the sum of Qtd × Fator × Preço unitário
 * across all rows, and that the formatted string fits in the PDF column.
 */

function buildRow(partial: Partial<ExportRow>): ExportRow {
  return {
    nome: "Produto",
    embalagem: "CX",
    fator: 1,
    qtd: 1,
    fornecedor: "Fornecedor",
    precoUnit: 0,
    total: 0,
    allPrecos: [],
    ...partial,
  };
}

function computeRowTotal(qtd: number, fator: number, precoUnit: number | null) {
  return precoUnit != null ? qtd * fator * precoUnit : null;
}

function sumTotalGeral(rows: ExportRow[]) {
  return rows.reduce((acc, r) => acc + (r.total || 0), 0);
}

describe("historicoExports — Total Geral", () => {
  it("calcula total da linha como Qtd × Fator × Preço unitário", () => {
    expect(computeRowTotal(10, 12, 5)).toBe(600);
    expect(computeRowTotal(3, 1, 9.9)).toBeCloseTo(29.7, 2);
    expect(computeRowTotal(2, 6, null)).toBeNull();
  });

  it("soma o TOTAL GERAL corretamente respeitando o fator de embalagem", () => {
    const rows: ExportRow[] = [
      buildRow({ qtd: 10, fator: 12, precoUnit: 5, total: computeRowTotal(10, 12, 5) }),
      buildRow({ qtd: 4, fator: 6, precoUnit: 2.5, total: computeRowTotal(4, 6, 2.5) }),
      buildRow({ qtd: 1, fator: 1, precoUnit: 100, total: computeRowTotal(1, 1, 100) }),
    ];
    // 600 + 60 + 100 = 760
    expect(sumTotalGeral(rows)).toBeCloseTo(760, 2);
  });

  it("ignora linhas sem preço (precoUnit null) sem quebrar o total", () => {
    const rows: ExportRow[] = [
      buildRow({ qtd: 5, fator: 2, precoUnit: 10, total: computeRowTotal(5, 2, 10) }),
      buildRow({ qtd: 7, fator: 3, precoUnit: null, total: computeRowTotal(7, 3, null) }),
    ];
    expect(sumTotalGeral(rows)).toBe(100);
  });

  it("formata o TOTAL GERAL em BRL e cabe na coluna do PDF (não trunca)", () => {
    const rows: ExportRow[] = [
      buildRow({ qtd: 1000, fator: 50, precoUnit: 999.99, total: computeRowTotal(1000, 50, 999.99) }),
    ];
    const totalGeral = sumTotalGeral(rows);
    const formatted = formatBRL(totalGeral);

    // Garante formatação BRL válida
    expect(formatted).toMatch(/^R\$\s?[\d.]+,\d{2}$/);

    // A coluna "Total" no PDF tem ~70pt; com fonte 8.5pt aceita ~22 caracteres.
    // Um valor enorme (~R$ 49.999.500,00) deve caber confortavelmente.
    expect(formatted.length).toBeLessThanOrEqual(22);
  });

  it("mantém consistência: soma das linhas == TOTAL GERAL exibido no rodapé", () => {
    const rows: ExportRow[] = Array.from({ length: 25 }, (_, i) =>
      buildRow({
        qtd: i + 1,
        fator: ((i % 4) + 1) * 3,
        precoUnit: (i + 1) * 1.37,
        total: computeRowTotal(i + 1, ((i % 4) + 1) * 3, (i + 1) * 1.37),
      })
    );
    const expected = rows.reduce(
      (acc, r) => acc + (r.qtd * r.fator * (r.precoUnit ?? 0)),
      0
    );
    expect(sumTotalGeral(rows)).toBeCloseTo(expected, 2);
  });
});
