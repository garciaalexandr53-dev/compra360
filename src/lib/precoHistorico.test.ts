import { describe, it, expect } from "vitest";
import { chaveProduto, classificar, variacao, formatPct } from "./precoHistorico";

describe("precoHistorico", () => {
  it("gera chave por catálogo, EAN ou nome", () => {
    expect(chaveProduto({ catalogo_mestre_id: "x", ean: "1", nome: "A" })).toBe("c:x");
    expect(chaveProduto({ ean: " 789 ", nome: "A" })).toBe("e:789");
    expect(chaveProduto({ nome: "  Arroz 5Kg " })).toBe("n:arroz 5kg");
  });
  it("classifica com tolerância de 3%", () => {
    expect(classificar(9.6, 10)).toBe("abaixo");
    expect(classificar(10.2, 10)).toBe("neutro");
    expect(classificar(10.5, 10)).toBe("acima");
    expect(classificar(0, 10)).toBeNull();
  });
  it("formata percentual", () => {
    expect(formatPct(variacao(11, 10))).toBe("+10,0%");
    expect(formatPct(variacao(9, 10))).toBe("-10,0%");
  });
});
