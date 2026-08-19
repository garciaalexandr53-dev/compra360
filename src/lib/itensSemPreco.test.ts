import { describe, it, expect } from "vitest";
import {
  filtrarItensSemPreco,
  buildCarryInserts,
  idsComPreco,
  type CotacaoProdutoLike,
} from "@/lib/itensSemPreco";

const cp = (over: Partial<CotacaoProdutoLike> = {}): CotacaoProdutoLike => ({
  id: "cp-1",
  produto_id: null,
  catalogo_mestre_id: null,
  nome: "Arroz 5kg",
  ean: null,
  quantidade: 2,
  tipo_embalagem: "FD",
  fator_embalagem: 6,
  ...over,
});

describe("filtrarItensSemPreco", () => {
  it("inclui item sem nenhuma linha de preço", () => {
    const r = filtrarItensSemPreco([cp()], []);
    expect(r).toHaveLength(1);
  });

  it("preço nulo ou zero conta como sem preço", () => {
    const r = filtrarItensSemPreco([cp()], [
      { cotacao_produto_id: "cp-1", preco: null },
      { cotacao_produto_id: "cp-1", preco: 0 },
    ]);
    expect(r).toHaveLength(1);
  });

  it("item com preço de qualquer fornecedor não entra", () => {
    const r = filtrarItensSemPreco([cp(), cp({ id: "cp-2" })], [
      { cotacao_produto_id: "cp-2", preco: 12.5 },
    ]);
    expect(r.map((i) => i.id)).toEqual(["cp-1"]);
  });

  it("aceita preço em string (vindo do banco como numeric)", () => {
    expect(idsComPreco([{ cotacao_produto_id: "cp-1", preco: "9.90" }]).has("cp-1")).toBe(true);
  });
});

describe("buildCarryInserts", () => {
  it("preserva snapshot completo do item", () => {
    const [row] = buildCarryInserts("nova", [
      cp({ catalogo_mestre_id: "cat-1", ean: "789", quantidade: 4 }),
    ]);
    expect(row).toEqual({
      cotacao_id: "nova",
      produto_id: null,
      catalogo_mestre_id: "cat-1",
      nome: "Arroz 5kg",
      ean: "789",
      quantidade: 4,
      tipo_embalagem: "FD",
      fator_embalagem: 6,
    });
  });

  it("normaliza quantidade e fator inválidos", () => {
    const [row] = buildCarryInserts("nova", [
      cp({ quantidade: 0, fator_embalagem: 0, tipo_embalagem: null }),
    ]);
    expect(row.quantidade).toBe(1);
    expect(row.fator_embalagem).toBe(1);
    expect(row.tipo_embalagem).toBeNull();
  });

  it("mantém produto local", () => {
    const [row] = buildCarryInserts("nova", [cp({ produto_id: "p-1" })]);
    expect(row.produto_id).toBe("p-1");
    expect(row.catalogo_mestre_id).toBeNull();
  });
});
