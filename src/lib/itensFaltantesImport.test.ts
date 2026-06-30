import { describe, it, expect } from "vitest";
import {
  buildCotacaoProdutoInsertFromItem,
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
      tipo_embalagem: "UN",
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
    expect(cp?.tipo_embalagem).toBe("UN");
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
    expect(cp?.tipo_embalagem).toBe("UN");
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
