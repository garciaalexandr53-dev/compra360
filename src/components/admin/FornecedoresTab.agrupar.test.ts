import { describe, it, expect } from "vitest";
import { agruparUnicos } from "./FornecedoresTab";
import type { FornecedorAdmin } from "@/lib/adminExports";

const base = (over: Partial<FornecedorAdmin>): FornecedorAdmin =>
  ({ id: crypto.randomUUID(), nome: "Distribuidora X", created_at: new Date().toISOString(), ...over }) as FornecedorAdmin;

describe("agruparUnicos", () => {
  it("junta cadastros com o mesmo WhatsApp mesmo com máscara diferente", () => {
    const r = agruparUnicos([
      base({ telefone: "(44) 99999-1234" }),
      base({ telefone: "44999991234" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].repeticoes).toBe(2);
  });

  it("junta por nome + representante quando não há telefone", () => {
    const r = agruparUnicos([
      base({ nome: "Atacado São José", representante: "José" }),
      base({ nome: "atacado sao jose", representante: "jose" }),
      base({ nome: "Outro Atacado", representante: "Ana" }),
    ]);
    expect(r).toHaveLength(2);
  });

  it("mantém separados fornecedores diferentes", () => {
    const r = agruparUnicos([
      base({ telefone: "44999991234" }),
      base({ telefone: "44988885678" }),
    ]);
    expect(r).toHaveLength(2);
  });
});
