import { describe, it, expect } from "vitest";
import {
  buildCotacaoProdutoInsertFromItem,
  chaveItemFaltante,
  agruparItensParaImportacao,
  contarRepeticoes,
  type ItemFaltanteRow,
  type ProdutoLocalCadastro,
} from "@/lib/itensFaltantesImport";

const baseItem = (over: Partial<ItemFaltanteRow> = {}): ItemFaltanteRow => ({
  id: "i-1",
  nome: "Coca Cola 2L",
  quantidade: 3,
  ean: null,
  catalogo_mestre_id: null,
  embalagem: null,
  fator_embalagem: null,
  observacao: null,
  ...over,
});

const localProd = (over: Partial<ProdutoLocalCadastro> = {}): ProdutoLocalCadastro => ({
  id: "p-1",
  nome: "Coca Cola 2L",
  embalagem: "CX",
  fator_embalagem: 12,
  ...over,
});

describe("buildCotacaoProdutoInsertFromItem — catálogo", () => {
  it("monta snapshot direto das colunas estruturadas (sem observacao)", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({
        catalogo_mestre_id: "cat-1",
        ean: "7894900011517",
        embalagem: "FD",
        fator_embalagem: 6,
        observacao: "lixo legado que deve ser ignorado",
      }),
    });
    expect(cp).toMatchObject({
      cotacao_id: "c-1",
      catalogo_mestre_id: "cat-1",
      produto_id: null,
      nome: "Coca Cola 2L",
      ean: "7894900011517",
      tipo_embalagem: "FD",
      fator_embalagem: 6,
      quantidade: 3,
    });
  });

  it("ignora produtoLocal quando o item é do catálogo", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({
        catalogo_mestre_id: "cat-1",
        ean: "789",
        embalagem: "FD",
        fator_embalagem: 6,
      }),
      produtoLocal: localProd(),
    });
    expect(cp?.produto_id).toBeNull();
    expect(cp?.catalogo_mestre_id).toBe("cat-1");
  });
});

describe("buildCotacaoProdutoInsertFromItem — local", () => {
  it("usa colunas estruturadas quando presentes (fator=1, emb='un')", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({ embalagem: "un", fator_embalagem: 1 }),
      produtoLocal: localProd(),
    });
    expect(cp).toMatchObject({
      catalogo_mestre_id: null,
      produto_id: "p-1",
      tipo_embalagem: "UNI",
      fator_embalagem: 1,
      ean: null,
    });
  });

  it("não cai para observacao quando as colunas têm valor", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({
        embalagem: "un",
        fator_embalagem: 1,
        observacao: "Fator: 99 | Embalagem: FD",
      }),
      produtoLocal: localProd(),
      legacyResolveFator: () => 99,
      legacyResolveEmb: () => "FD",
    });
    expect(cp?.fator_embalagem).toBe(1);
    expect(cp?.tipo_embalagem).toBe("UNI");
  });

  it("cai para resolver legacy quando colunas estruturadas estão vazias", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({ observacao: "Fator: 1 | Embalagem: un" }),
      produtoLocal: localProd(),
      legacyResolveFator: (obs) => (obs?.includes("Fator: 1") ? 1 : 12),
      legacyResolveEmb: (obs) => (obs?.includes("un") ? "UN" : "CX"),
    });
    expect(cp?.fator_embalagem).toBe(1);
    expect(cp?.tipo_embalagem).toBe("UNI");
  });

  it("sem produtoLocal retorna null (item local precisa de match)", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({ embalagem: "un", fator_embalagem: 1 }),
      produtoLocal: null,
    });
    expect(cp).toBeNull();
  });

  it("usa cadastro do produto quando nada foi informado", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem(),
      produtoLocal: localProd(),
    });
    expect(cp?.tipo_embalagem).toBe("CX");
    expect(cp?.fator_embalagem).toBe(12);
  });

  it("snapshot nunca grava ean para itens locais", () => {
    const cp = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c-1",
      item: baseItem({ ean: "789" /* nunca deveria existir, mas... */ }),
      produtoLocal: localProd(),
    });
    expect(cp?.ean).toBeNull();
  });
});

describe("chaveItemFaltante / agruparItensParaImportacao", () => {
  it("usa catalogo_mestre_id como chave primária", () => {
    expect(chaveItemFaltante({ catalogo_mestre_id: "c1", ean: "123", nome: "X" })).toBe("cat:c1");
  });

  it("usa EAN quando não há item de catálogo", () => {
    expect(chaveItemFaltante({ ean: "7891150070974", nome: "Amaciante" })).toBe("ean:7891150070974");
  });

  it("normaliza nome (acento, caixa, espaços) quando não há EAN", () => {
    expect(chaveItemFaltante({ nome: "Leite  de Côco  SOCOCO 200ml" })).toBe(
      chaveItemFaltante({ nome: "leite de coco sococo 200ml" }),
    );
  });

  it("agrupa repetições do catálogo somando quantidades", () => {
    const grupos = agruparItensParaImportacao([
      { catalogo_mestre_id: "c1", nome: "Amaciante", quantidade: 2 },
      { catalogo_mestre_id: "c1", nome: "Amaciante", quantidade: 3 },
      { catalogo_mestre_id: "c1", nome: "Amaciante", quantidade: null },
      { catalogo_mestre_id: "c2", nome: "Shampoo", quantidade: 1 },
    ]);
    expect(grupos).toHaveLength(2);
    const amaciante = grupos.find((g) => g.chave === "cat:c1")!;
    expect(amaciante.quantidadeTotal).toBe(6);
    expect(amaciante.ocorrencias).toBe(3);
  });

  it("agrupa EAN igual mesmo com nomes diferentes", () => {
    const grupos = agruparItensParaImportacao([
      { ean: "111", nome: "Leite de Coco Sococo Vidro 200ml", quantidade: 1 },
      { ean: "111", nome: "Leite De Côco Sococo 200ml Vidro", quantidade: 4 },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].quantidadeTotal).toBe(5);
  });

  it("não agrupa produtos distintos sem EAN", () => {
    const grupos = agruparItensParaImportacao([
      { nome: "Arroz 5kg", quantidade: 1 },
      { nome: "Feijão 1kg", quantidade: 1 },
    ]);
    expect(grupos).toHaveLength(2);
  });
});

describe("contarRepeticoes", () => {
  it("conta ocorrências por identidade", () => {
    const c = contarRepeticoes([
      { catalogo_mestre_id: "c1", nome: "A" },
      { catalogo_mestre_id: "c1", nome: "A" },
      { nome: "Bolacha Maria" },
    ]);
    expect(c.get("cat:c1")).toBe(2);
    expect(c.get(chaveItemFaltante({ nome: "bolacha maria" }))).toBe(1);
  });
});
