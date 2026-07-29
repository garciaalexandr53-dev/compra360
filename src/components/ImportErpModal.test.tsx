import { describe, it, expect } from "vitest";
import { extractEan, normalizeEmbalagem, classificarDestino, planejarLinhas, findLocalExato } from "./ImportErpModal";
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

describe("caminho LOCAL: match exato, embalagem e dedup", () => {
  const mkItem = (nome: string, embalagem = "un", quantidade = 1, ean: string | null = null) =>
    ({ nome, embalagem, quantidade, ean });

  const existing = new Map<string, any>([
    ["toddy achocolatado 400g", { id: "p-a", nome: "Toddy Achocolatado 400g", embalagem: "UNI", fator_embalagem: 1 }],
    ["toddy sachet 200g", { id: "p-b", nome: "Toddy Sachet 200g", embalagem: "UNI", fator_embalagem: 1 }],
  ]);

  it("(a) nome parecido não casa — cria produto novo", () => {
    const plano = planejarLinhas([mkItem("Toddy Sachet 300g")], new Map(), existing);
    expect(plano).toHaveLength(1);
    expect(plano[0].destino).toBe("local");
    expect(plano[0].prod).toBeNull();
  });

  it("nome idêntico (case/espaços) casa exato", () => {
    const plano = planejarLinhas([mkItem("  TODDY SACHET 200G ")], new Map(), existing);
    expect(plano[0].prod?.id).toBe("p-b");
  });

  it("(b) embalagem da planilha é normalizada: sc→PCT, kg→KG, fd→FD", () => {
    const plano = planejarLinhas(
      [mkItem("Arroz", "sc"), mkItem("Banana", "kg"), mkItem("Refri", "fd")],
      new Map(),
      existing,
    );
    expect(plano.map((l) => l.embalagem)).toEqual(["PCT", "KG", "FD"]);
  });

  it("(c) mesmo item duas vezes não duplica", () => {
    const plano = planejarLinhas(
      [mkItem("Feijao Preto", "sc", 2), mkItem("feijao preto", "sc", 5)],
      new Map(),
      existing,
    );
    expect(plano).toHaveLength(1);
    expect(plano[0].item.quantidade).toBe(5);
  });

  it("mesmo EAN de catálogo duas vezes não duplica", () => {
    const cat = new Map<string, any>([
      ["7891234567890", { id: "cm-1", nome: "ARROZ", ean: "7891234567890", embalagem: "FD", fator_embalagem: 6 }],
    ]);
    const plano = planejarLinhas(
      [mkItem("Arroz", "cx", 1, "7891234567890"), mkItem("Arroz tipo 1", "cx", 3, "7891234567890")],
      cat,
      existing,
    );
    expect(plano).toHaveLength(1);
    expect(plano[0].destino).toBe("catalogo");
  });
});

describe("findLocalExato", () => {
  const m = new Map<string, any>([["cafe pilao 500g", { id: "p1", nome: "Cafe Pilao 500g", embalagem: "UNI", fator_embalagem: 1 }]]);
  it("casa exato e não casa parecido", () => {
    expect(findLocalExato("CAFE PILAO 500G", m)?.id).toBe("p1");
    expect(findLocalExato("Cafe Pilao", m)).toBeNull();
    expect(findLocalExato("Cafe Pilao 500g Extra", m)).toBeNull();
  });
});
