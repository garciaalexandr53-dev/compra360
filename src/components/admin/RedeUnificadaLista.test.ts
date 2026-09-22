import { describe, it, expect } from "vitest";
import { presencaLabel, paraFornecedorAdmin, RedeFornecedor } from "./RedeUnificadaLista";

const base: RedeFornecedor = {
  id: "1", nome: "Distribuidora Alfa", representante: "João", telefone: "44999990000",
  email: null, pedido_minimo: 500, prazo_pagamento: "28 dias", created_at: "2026-01-01T00:00:00Z",
  tipo_fornecedor: "geral", pasta: null, origem_cadastro: "autocadastro", consentimento_rede: "sim",
  cadastros: 3, clientes: 2, lojas_vinculadas: 4, cidades: ["Maringá", "Sarandi"],
  clientes_nomes: ["Mercado X"], na_rede: true,
};

describe("presencaLabel", () => {
  it("usa plural corretamente", () => {
    expect(presencaLabel({ clientes: 2, lojas_vinculadas: 4 })).toBe("2 clientes · 4 lojas");
    expect(presencaLabel({ clientes: 1, lojas_vinculadas: 1 })).toBe("1 cliente · 1 loja");
  });
  it("omite lojas quando não há vínculo", () => {
    expect(presencaLabel({ clientes: 1, lojas_vinculadas: 0 })).toBe("1 cliente");
  });
});

describe("paraFornecedorAdmin", () => {
  it("marca duplicado quando há mais de um cadastro", () => {
    expect(paraFornecedorAdmin(base).duplicado).toBe(true);
    expect(paraFornecedorAdmin({ ...base, cadastros: 1 }).duplicado).toBe(false);
  });
  it("mantém dados de contato e primeira cidade", () => {
    const f = paraFornecedorAdmin(base);
    expect(f.nome).toBe("Distribuidora Alfa");
    expect(f.telefone).toBe("44999990000");
    expect(f.cidade).toBe("Maringá");
    expect(f.lojas_vinculadas).toBe(4);
  });
});
