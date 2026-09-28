import { describe, it, expect } from "vitest";
import { ordenarPorNome } from "./ordenarPorNome";

describe("ordenarPorNome", () => {
  it("ordena A-Z ignorando acentos e caixa", () => {
    const r = ordenarPorNome([{ n: "detergente" }, { n: "Açúcar" }, { n: "Banana" }, { n: "abacaxi" }], (i) => i.n);
    expect(r.map((i) => i.n)).toEqual(["abacaxi", "Açúcar", "Banana", "detergente"]);
  });
});
