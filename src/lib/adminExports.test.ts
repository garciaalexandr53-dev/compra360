import { describe, it, expect } from "vitest";
import {
  buildCsv, csvEscape, formatDateBR, todayFileSuffix,
  buildClientesCsv, buildAlertasCsv, clienteRow, alertaRow,
  clientesFilename, clientesFilenameXlsx, alertasTrialsFilename, alertasChurnFilename,
  buildClientesXlsx, buildXlsx,
} from "./adminExports";
import type { Cliente } from "./adminHelpers";

function makeCliente(over: Partial<Cliente> = {}): Cliente {
  return {
    user_id: "u1",
    email: "loja@teste.com",
    created_at: "2026-01-15T12:00:00Z",
    loja_principal: "Mercado Bom Preço",
    cnpj: "12.345.678/0001-99",
    whatsapp: "11999998888",
    total_lojas: 2,
    total_produtos: 50,
    total_produtos_inativos: 0,
    total_fornecedores: 10,
    total_cotacoes: 7,
    total_pedidos: 5,
    plan_name: "pro",
    plan_status: "active",
    trial_end: null,
    ultima_cotacao_at: "2026-05-10T10:00:00Z",
    ...over,
  };
}

describe("csvEscape", () => {
  it("retorna vazio para null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
  it("escapa campos com separador, aspas ou quebra de linha", () => {
    expect(csvEscape("a;b")).toBe('"a;b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape("linha\nnova")).toBe('"linha\nnova"');
  });
  it("não escapa strings simples", () => {
    expect(csvEscape("abc")).toBe("abc");
  });
});

describe("buildCsv", () => {
  it("usa UTF-8 puro sem BOM e separa colunas com ;", () => {
    const csv = buildCsv(["A", "B"], [[1, 2]]);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv).toContain("A;B");
    expect(csv).toContain("1;2");
  });
  it("preserva caracteres acentuados (Ação, Cotação, Supermercado)", () => {
    const csv = buildCsv(["Nome"], [["Supermercado Ação"], ["Cotação BR"]]);
    expect(csv).toContain("Supermercado Ação");
    expect(csv).toContain("Cotação BR");
  });
});

describe("formatDateBR", () => {
  it("formata ISO em DD/MM/AAAA", () => {
    expect(formatDateBR("2026-05-18T10:00:00Z")).toMatch(/\d{2}\/\d{2}\/2026/);
  });
  it("retorna vazio para entrada nula", () => {
    expect(formatDateBR(null)).toBe("");
    expect(formatDateBR(undefined)).toBe("");
  });
});

describe("todayFileSuffix", () => {
  it("retorna YYYY-MM-DD", () => {
    expect(todayFileSuffix(new Date("2026-05-18T03:00:00"))).toBe("2026-05-18");
  });
});

describe("clienteRow", () => {
  it("monta as 14 colunas na ordem certa", () => {
    const row = clienteRow(makeCliente());
    expect(row).toHaveLength(14);
    expect(row[0]).toBe("Mercado Bom Preço");
    expect(row[1]).toBe("loja@teste.com");
    expect(row[4]).toBe("Pro");
    expect(row[13]).toBe(""); // sem trial
  });

  it("preenche dias de trial quando aplicável", () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    const row = clienteRow(makeCliente({ plan_status: "trialing", trial_end: future, plan_name: "free" }));
    expect(row[5]).toBe("Trial");
    expect(String(row[13])).toMatch(/dias/);
  });
});

describe("buildClientesCsv", () => {
  it("respeita a lista filtrada passada", () => {
    const csv = buildClientesCsv([makeCliente({ loja_principal: "A" }), makeCliente({ loja_principal: "B" })]);
    const linhas = csv.split("\r\n");
    expect(linhas[0]).toContain("Nome da loja");
    expect(linhas).toHaveLength(3); // header + 2 linhas
  });
});

describe("alertaRow", () => {
  it("usa dias até expirar para trials", () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    const row = alertaRow(makeCliente({ plan_status: "trialing", trial_end: future }), "trial");
    expect(String(row[4])).toContain("até expirar");
  });
  it("usa dias sem uso para churn", () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    const row = alertaRow(makeCliente({ ultima_cotacao_at: old }), "churn");
    expect(String(row[4])).toContain("sem uso");
  });
});

describe("buildAlertasCsv", () => {
  it("gera CSV com cabeçalho de alertas", () => {
    const csv = buildAlertasCsv([makeCliente()], "churn");
    expect(csv).toContain("Nome da loja;Email;Plano;Status;Dias;Telefone");
  });
});

describe("filenames", () => {
  const d = new Date("2026-05-18T10:00:00");
  it("usa o padrão clientes_compra360_YYYY-MM-DD.csv", () => {
    expect(clientesFilename(d)).toBe("clientes_compra360_2026-05-18.csv");
  });
  it("usa o padrão alertas_trials_YYYY-MM-DD.csv", () => {
    expect(alertasTrialsFilename(d)).toBe("alertas_trials_2026-05-18.csv");
  });
  it("usa o padrão alertas_churn_YYYY-MM-DD.csv", () => {
    expect(alertasChurnFilename(d)).toBe("alertas_churn_2026-05-18.csv");
  });
});
