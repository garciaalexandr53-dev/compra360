import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync, existsSync } from "fs";
import { detectarEspelhoPedido } from "./planilhaImport";

const rows: unknown[][] = [
  ["BRAND VAREJAO - ST"],
  ["=========> PEDIDO DE COMPRA <========="],
  ["Fornec._:", null, null, null, "005142 ALIMENTOS ZAELI TLDA"],
  ["003893", null, null, "PAINCO ZAELI 500G"],
  ["12,000", null, null, null, "x", "2,57", null, "30,80"],
  ["009901", null, null, "VINHO ZAELI TINTO 750ML"],
  ["25,000", null, null, null, "x", "26,09", null, "652,25"],
  [null, null, null, null, "SubTotal:", null, "682,05"],
];

describe("detectarEspelhoPedido", () => {
  it("junta as duas linhas de cada item", () => {
    const r = detectarEspelhoPedido(rows)!;
    expect(r.fornecedor).toBe("ALIMENTOS ZAELI TLDA");
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0]).toMatchObject({ nome: "PAINCO ZAELI 500G", quantidade: 12, preco: 2.57, codigo_interno: "003893" });
  });
  it("não confunde planilha comum", () => {
    expect(detectarEspelhoPedido([["Produto", "Qtd"], ["Arroz", 2], ["Feijão", 3]])).toBeNull();
  });
  it("lê o arquivo real da Zaeli", () => {
    if (!existsSync("/tmp/z.xlsx")) return;
    const wb = XLSX.read(readFileSync("/tmp/z.xlsx"));
    const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
    const r = detectarEspelhoPedido(data)!;
    expect(r.itens).toHaveLength(34);
  });
});
