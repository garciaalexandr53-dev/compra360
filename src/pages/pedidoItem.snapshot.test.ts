import { describe, it, expect } from "vitest";

// Replica a lógica de montagem do item usada em PedidosPage, AnalisePage e PedidosContent:
// snapshot (cp.nome / cp.tipo_embalagem) é a fonte da verdade; produtos é fallback.
function buildItem(cp: any) {
  return {
    produto: cp.nome || cp.produtos?.nome || "?",
    embalagem: cp.tipo_embalagem || cp.produtos?.embalagem || "un",
  };
}

describe("PEDIDO DE COMPRA — snapshot do item", () => {
  it("usa cp.nome quando produto_id é NULL (catálogo mestre)", () => {
    const cp = {
      produto_id: null,
      nome: "Arroz Tio João 5kg",
      tipo_embalagem: "fardo",
      produtos: null,
    };
    const item = buildItem(cp);
    expect(item.produto).toBe("Arroz Tio João 5kg");
    expect(item.produto).not.toBe("?");
    expect(item.embalagem).toBe("fardo");
  });

  it("faz fallback para produtos.nome quando cp.nome estiver vazio", () => {
    const cp = {
      produto_id: "abc",
      nome: null,
      tipo_embalagem: null,
      produtos: { nome: "Feijão", embalagem: "kg" },
    };
    expect(buildItem(cp)).toEqual({ produto: "Feijão", embalagem: "kg" });
  });

  it("usa '?' e 'un' quando nada estiver disponível", () => {
    expect(buildItem({})).toEqual({ produto: "?", embalagem: "un" });
  });
});
