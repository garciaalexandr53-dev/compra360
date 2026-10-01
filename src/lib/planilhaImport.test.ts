import { describe, it, expect } from "vitest";
import {
  detectarSeparador,
  lerCsv,
  detectarLinhaCabecalho,
  sugerirMapeamento,
  parseNumero,
  separarEmbalagemFator,
  aplicarMapeamento,
  exemplosDaColuna,
} from "./planilhaImport";

describe("detectarSeparador", () => {
  it("reconhece ponto e vírgula, vírgula e tab", () => {
    expect(detectarSeparador("a;b;c\n1;2;3")).toBe(";");
    expect(detectarSeparador("a,b,c\n1,2,3")).toBe(",");
    expect(detectarSeparador("a\tb\tc")).toBe("\t");
  });
});

describe("lerCsv", () => {
  it("respeita campos entre aspas com separador dentro", () => {
    const rows = lerCsv('PRODUTO;QTD\n"ARROZ, TIPO 1";10');
    expect(rows[1]).toEqual(["ARROZ, TIPO 1", "10"]);
  });

  it("descarta linhas totalmente vazias", () => {
    expect(lerCsv("a;b\n\n1;2")).toHaveLength(2);
  });
});

describe("detectarLinhaCabecalho", () => {
  it("ignora título e linhas em branco do topo do relatório do ERP", () => {
    const rows = [
      ["RELATORIO DE SUGESTAO DE COMPRA"],
      ["Emitido em 30/09/2026"],
      [],
      ["CD_ITEM", "DESCRICAO_ITEM", "QT_SUGESTAO", "UM"],
      ["1001", "ARROZ TIPO 1 5KG", "10", "FD"],
    ];
    expect(detectarLinhaCabecalho(rows)).toBe(3);
  });
});

describe("sugerirMapeamento", () => {
  it("reconhece cabeçalhos de ERP com prefixos e underscores", () => {
    const map = sugerirMapeamento(["CD_ITEM", "DESCRICAO_ITEM", "QT_SUGESTAO", "UM", "CD_EAN"]);
    expect(map.nome).toBe(1);
    expect(map.quantidade).toBe(2);
    expect(map.embalagem).toBe(3);
    expect(map.ean).toBe(4);
    expect(map.codigo_interno).toBe(0);
  });

  it("reconhece o fator de conversão como campo próprio", () => {
    const map = sugerirMapeamento(["Produto", "Embalagem", "Qtd por embalagem", "Quantidade"]);
    expect(map.fator).toBe(2);
    expect(map.embalagem).toBe(1);
    expect(map.quantidade).toBe(3);
  });

  it("nunca usa a mesma coluna para dois campos", () => {
    const map = sugerirMapeamento(["Produto", "Produto", "Qtd"]);
    const usados = Object.values(map);
    expect(new Set(usados).size).toBe(usados.length);
  });
});

describe("parseNumero", () => {
  it("entende formato brasileiro e texto com unidade", () => {
    expect(parseNumero("1.234,50")).toBe(1234.5);
    expect(parseNumero("12,5")).toBe(12.5);
    expect(parseNumero("12 un")).toBe(12);
    expect(parseNumero(7)).toBe(7);
    expect(parseNumero("")).toBeNull();
    expect(parseNumero("abc")).toBeNull();
  });
});

describe("separarEmbalagemFator", () => {
  it("separa sigla e fator da mesma célula", () => {
    expect(separarEmbalagemFator("CX 12")).toEqual({ sigla: "CX", fator: 12 });
    expect(separarEmbalagemFator("FD/6")).toEqual({ sigla: "FD", fator: 6 });
    expect(separarEmbalagemFator("UN")).toEqual({ sigla: "UN", fator: null });
    expect(separarEmbalagemFator("")).toEqual({ sigla: "", fator: null });
  });
});

describe("aplicarMapeamento", () => {
  const rows = [
    ["DESCRICAO_ITEM", "QT_SUGESTAO", "UM", "FATOR", "CD_EAN"],
    ["ARROZ TIPO 1 5KG", "10", "FD", "6", "7891234567890"],
    ["", "5", "CX", "12", ""],
    ["REFRIGERANTE 2L", "", "CX 12", "", "789-1111-22223"],
  ];
  const map = { nome: 0, quantidade: 1, embalagem: 2, fator: 3, ean: 4 } as const;

  it("converte linhas e usa quantidade 1 quando vazio", () => {
    const { itens } = aplicarMapeamento(rows, 0, map);
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ nome: "ARROZ TIPO 1 5KG", quantidade: 10, embalagem: "FD", fator: 6, ean: "7891234567890" });
    expect(itens[1]).toMatchObject({ nome: "REFRIGERANTE 2L", quantidade: 1, fator: 12, ean: "789111122223" });
  });

  it("registra o motivo de cada linha ignorada", () => {
    const { ignoradas } = aplicarMapeamento(rows, 0, map);
    expect(ignoradas).toEqual([{ linha: 3, motivo: "Sem nome do produto" }]);
  });

  it("funciona sem colunas opcionais mapeadas", () => {
    const { itens } = aplicarMapeamento(rows, 0, { nome: 0 });
    expect(itens[0]).toMatchObject({ quantidade: 1, ean: null, fator: null, categoria: null });
  });
});

describe("exemplosDaColuna", () => {
  it("devolve os primeiros valores preenchidos", () => {
    const rows = [["H"], ["a"], [""], ["b"], ["c"], ["d"]];
    expect(exemplosDaColuna(rows, 0, 0)).toEqual(["a", "b", "c"]);
  });
});
