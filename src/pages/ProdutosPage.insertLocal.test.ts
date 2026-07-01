import { describe, it, expect } from "vitest";
import { buildSnapshotInsert, type ProdutoHibrido } from "@/lib/buscaProdutos";

/**
 * Regression: ao adicionar um produto LOCAL à cotação via ProdutosPage, o insert
 * em cotacao_produtos DEVE gravar `nome` (snapshot) — antes ficava NULL porque
 * a mutation inseria apenas produto_id/quantidade.
 *
 * ProdutosPage delega o payload a `buildSnapshotInsert` (fonte única). Este
 * teste garante o contrato para a fonte local, com e sem overrides do diálogo.
 */
describe("ProdutosPage — insert de produto LOCAL grava nome", () => {
  const produtoLocal: ProdutoHibrido = {
    fonte: "local",
    id: "produto-uuid-1",
    nome: "Arroz Tio João 5kg",
    ean: null,
    embalagem: "FD",
    fator_embalagem: 6,
  };

  it("grava nome, produto_id, ean=null e catalogo_mestre_id=null", () => {
    const snap = buildSnapshotInsert({
      cotacaoId: "cot-1",
      produto: produtoLocal,
      quantidade: 1,
    });

    expect(snap.nome).toBe("Arroz Tio João 5kg");
    expect(snap.nome).not.toBeNull();
    expect(snap.produto_id).toBe("produto-uuid-1");
    expect(snap.catalogo_mestre_id).toBeNull();
    expect(snap.ean).toBeNull();
    expect(snap.tipo_embalagem).toBe("FD");
    expect(snap.fator_embalagem).toBe(6);
    expect(snap.quantidade).toBe(1);
  });

  it("respeita override de embalagem/fator vindos do diálogo, mantendo nome", () => {
    const snap = buildSnapshotInsert({
      cotacaoId: "cot-1",
      produto: produtoLocal,
      quantidade: 4,
      embalagem: "UNI",
      fator: 1,
    });

    expect(snap.nome).toBe("Arroz Tio João 5kg");
    expect(snap.tipo_embalagem).toBe("UNI");
    expect(snap.fator_embalagem).toBe(1);
    expect(snap.quantidade).toBe(4);
  });

  it("produto local sem embalagem/fator ainda grava nome (nunca NULL)", () => {
    const snap = buildSnapshotInsert({
      cotacaoId: "cot-1",
      produto: { ...produtoLocal, embalagem: null, fator_embalagem: null },
      quantidade: 1,
    });

    expect(snap.nome).toBe("Arroz Tio João 5kg");
    expect(snap.tipo_embalagem).toBeTruthy();
    expect(snap.fator_embalagem).toBeGreaterThan(0);
  });
});
