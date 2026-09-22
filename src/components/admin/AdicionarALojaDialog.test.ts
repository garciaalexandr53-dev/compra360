import { describe, it, expect } from "vitest";
import { resumoVinculoLabel, lojaLabel, type LojaCliente } from "./AdicionarALojaDialog";

describe("resumoVinculoLabel", () => {
  it("usa singular e plural corretos", () => {
    expect(resumoVinculoLabel({ criados: 1, vinculados: 1, ja_vinculados: 0 })).toBe(
      "1 fornecedor adicionado à loja · 1 novo cadastro criado",
    );
    expect(resumoVinculoLabel({ criados: 0, vinculados: 3, ja_vinculados: 2 })).toBe(
      "3 fornecedores adicionados à loja · 2 já estavam na loja",
    );
  });

  it("omite partes zeradas", () => {
    expect(resumoVinculoLabel({ criados: 0, vinculados: 2, ja_vinculados: 0 })).toBe(
      "2 fornecedores adicionados à loja",
    );
  });
});

describe("lojaLabel", () => {
  const base: LojaCliente = {
    loja_id: "1", loja_nome: "mercado central", cidade: "maringa", uf: "pr",
    user_id: "u1", cliente_nome: "alexandre garcia", cliente_email: "a@b.com", total_fornecedores: 4,
  };

  it("mostra cliente, loja e cidade", () => {
    expect(lojaLabel(base)).toContain("PR");
    expect(lojaLabel(base)).toContain("·");
  });

  it("usa e-mail quando não há nome", () => {
    expect(lojaLabel({ ...base, cliente_nome: null })).toContain("a@b.com");
  });
});
