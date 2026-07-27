import { describe, it, expect } from "vitest";
import { extractEan, normalizeEmbalagem, classificarDestino } from "./ImportErpModal";
import { buildSnapshotInsert } from "@/lib/buscaProdutos";

describe("extractEan", () => {
  it("returns only digits from EAN column value", () => {
    expect(extractEan("7 891234 567890")).toBe("7891234567890");
    expect(extractEan("789-1234-567890")).toBe("7891234567890");
    expect(extractEan("'07891234567890")).toBe("07891234567890");
  });

  it("preserves leading zeros and GTIN-14", () => {
    expect(extractEan("00789123456789")).toBe("00789123456789");
    expect(extractEan("12345678901234")).toBe("12345678901234");
  });

  it("returns null when no digits", () => {
    expect(extractEan("")).toBeNull();
    expect(extractEan("   ")).toBeNull();
    expect(extractEan("abc")).toBeNull();
    expect(extractEan(null)).toBeNull();
    expect(extractEan(undefined)).toBeNull();
  });

  it("handles numeric inputs (xlsx cells)", () => {
    expect(extractEan(7891234567890)).toBe("7891234567890");
  });
});

describe("normalizeEmbalagem", () => {
  it("mapeia valores conhecidos (case-insensitive)", () => {
    expect(normalizeEmbalagem("cx")).toBe("CX");
    expect(normalizeEmbalagem("CX")).toBe("CX");
    expect(normalizeEmbalagem(" Fd ")).toBe("FD");
    expect(normalizeEmbalagem("kg")).toBe("KG");
    expect(normalizeEmbalagem("sc")).toBe("PCT");
    expect(normalizeEmbalagem("unid")).toBe("UNI");
    expect(normalizeEmbalagem("uni")).toBe("UNI");
    expect(normalizeEmbalagem("un")).toBe("UNI");
    expect(normalizeEmbalagem("dz")).toBe("DZ");
    expect(normalizeEmbalagem("pct")).toBe("PCT");
    expect(normalizeEmbalagem("pc")).toBe("PCT");
  });

  it("cai em UNI para valores desconhecidos ou vazios", () => {
    expect(normalizeEmbalagem("caixote")).toBe("UNI");
    expect(normalizeEmbalagem("")).toBe("UNI");
    expect(normalizeEmbalagem(null)).toBe("UNI");
    expect(normalizeEmbalagem(undefined)).toBe("UNI");
  });
});

describe("classificarDestino (3 casos)", () => {
  const cat = new Map<string, unknown>([["7891234567890", { id: "cm-1" }]]);

  it("caso 1: EAN existe no catálogo mestre → catálogo", () => {
    expect(classificarDestino({ ean: "7891234567890" }, cat)).toBe("catalogo");
  });

  it("caso 2: tem EAN mas não existe no mestre → local", () => {
    expect(classificarDestino({ ean: "0000000000000" }, cat)).toBe("local");
  });

  it("caso 3: sem EAN → local", () => {
    expect(classificarDestino({ ean: null }, cat)).toBe("local");
  });
});

describe("snapshot por destino", () => {
  it("caso 1 copia nome/ean/embalagem/fator do mestre e zera produto_id", () => {
    const insert = buildSnapshotInsert({
      cotacaoId: "c1",
      quantidade: 3,
      produto: {
        fonte: "catalogo",
        id: "cm-1",
        nome: "ARROZ TIPO 1 5KG",
        ean: "7891234567890",
        embalagem: "FD",
        fator_embalagem: 6,
      },
    });
    expect(insert).toMatchObject({
      catalogo_mestre_id: "cm-1",
      produto_id: null,
      nome: "ARROZ TIPO 1 5KG",
      ean: "7891234567890",
      tipo_embalagem: "FD",
      fator_embalagem: 6,
      quantidade: 3,
    });
  });

  it("casos 2/3 usam produto local com embalagem normalizada da planilha", () => {
    const insert = buildSnapshotInsert({
      cotacaoId: "c1",
      quantidade: 2,
      produto: {
        fonte: "local",
        id: "p-1",
        nome: "FEIJAO PRETO",
        ean: null,
        embalagem: "UNI",
        fator_embalagem: 1,
      },
      embalagem: normalizeEmbalagem("sc"),
    });
    expect(insert).toMatchObject({
      produto_id: "p-1",
      catalogo_mestre_id: null,
      nome: "FEIJAO PRETO",
      ean: null,
      tipo_embalagem: "PCT",
      quantidade: 2,
    });
    expect(insert.nome).toBeTruthy();
  });
});
