import { describe, it, expect } from "vitest";
import {
  FORNECEDORES_HEADER, fornecedorRow, normalizarNomeFornecedor, fornecedoresFilenameXlsx,
  type FornecedorAdmin,
} from "./adminExports";

const base: FornecedorAdmin = {
  id: "f1",
  nome: "Distribuidora Alfa",
  representante: "João",
  telefone: "44999990000",
  email: "joao@alfa.com",
  pedido_minimo: 500,
  prazo_pagamento: "28 dias",
  created_at: "2026-09-10T12:00:00.000Z",
  user_id: "u1",
  cliente_nome: "Alexandre",
  cliente_empresa: "Mercado Central",
  cliente_email: "alex@central.com",
  cidade: "Maringá",
  uf: "PR",
  lojas_vinculadas: 2,
  duplicado: false,
};

describe("export de fornecedores", () => {
  it("gera a linha na mesma ordem do cabeçalho", () => {
    const row = fornecedorRow(base);
    expect(row).toHaveLength(FORNECEDORES_HEADER.length);
    expect(row[0]).toBe("Distribuidora Alfa");
    expect(row[6]).toBe("Alexandre");
    expect(row[7]).toBe("Mercado Central");
    expect(row[8]).toBe("Maringá/PR");
    expect(row[9]).toBe(2);
  });

  it("usa vazio nos campos ausentes e cai no e-mail quando não há nome", () => {
    const row = fornecedorRow({
      ...base,
      representante: null, telefone: null, email: null, pedido_minimo: null,
      prazo_pagamento: null, cliente_nome: null, cliente_empresa: null,
      cidade: null, uf: null,
    });
    expect(row[1]).toBe("");
    expect(row[4]).toBe("");
    expect(row[6]).toBe("alex@central.com");
    expect(row[8]).toBe("");
  });

  it("usa só a cidade ou só a UF quando um deles falta", () => {
    expect(fornecedorRow({ ...base, uf: null })[8]).toBe("Maringá");
    expect(fornecedorRow({ ...base, cidade: null })[8]).toBe("PR");
  });

  it("nome do arquivo tem a data", () => {
    expect(fornecedoresFilenameXlsx(new Date(2026, 8, 17))).toMatch(/^fornecedores_compra360_.*\.xlsx$/);
  });
});

describe("normalizarNomeFornecedor", () => {
  it("ignora acentos, caixa e espaços extras", () => {
    expect(normalizarNomeFornecedor("  Distribuidora   ALFA ")).toBe("distribuidora alfa");
    expect(normalizarNomeFornecedor("Atacadão São José")).toBe("atacadao sao jose");
  });

  it("considera iguais nomes escritos de formas diferentes", () => {
    expect(normalizarNomeFornecedor("Açaí Distribuidora")).toBe(normalizarNomeFornecedor("ACAI  distribuidora"));
  });
});
