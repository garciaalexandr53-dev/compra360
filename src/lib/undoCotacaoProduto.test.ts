import { describe, it, expect } from "vitest";
import { buildUndoInsert } from "@/lib/undoCotacaoProduto";

describe("buildUndoInsert — desfazer exclusão de cotacao_produtos", () => {
  it("item do catálogo: preserva nome real, catalogo_mestre_id e produto_id null", () => {
    const saved = {
      cpId: "cp-1",
      cotacao_id: "cot-1",
      produto_id: null,
      catalogo_mestre_id: "cat-1",
      nome: "Coca Cola 2L",
      ean: "7894900011517",
      tipo_embalagem: "FD",
      fator_embalagem: 6,
      quantidade: 3,
    };
    const payload = buildUndoInsert(saved);
    expect(payload.nome).toBe("Coca Cola 2L");
    expect(payload.catalogo_mestre_id).toBe("cat-1");
    expect(payload.produto_id).toBeNull();
    expect(payload.ean).toBe("7894900011517");
    expect(payload.id).toBe("cp-1");
    expect(payload.cotacao_id).toBe("cot-1");
    expect(payload.tipo_embalagem).toBe("FD");
    expect(payload.fator_embalagem).toBe(6);
    expect(payload.quantidade).toBe(3);
  });

  it("item local: preserva nome real, produto_id e catalogo_mestre_id null", () => {
    const saved = {
      cpId: "cp-2",
      cotacao_id: "cot-1",
      produto_id: "prod-9",
      catalogo_mestre_id: null,
      nome: "Pão Francês",
      ean: null,
      tipo_embalagem: "KG",
      fator_embalagem: 1,
      quantidade: 5,
    };
    const payload = buildUndoInsert(saved);
    expect(payload.nome).toBe("Pão Francês");
    expect(payload.produto_id).toBe("prod-9");
    expect(payload.catalogo_mestre_id).toBeNull();
    expect(payload.ean).toBeNull();
    expect(payload.tipo_embalagem).toBe("KG");
    expect(payload.fator_embalagem).toBe(1);
    expect(payload.quantidade).toBe(5);
  });
});
