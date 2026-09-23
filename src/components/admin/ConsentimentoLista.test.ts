import { describe, expect, it } from "vitest";
import {
  formatCnpjBR, consentimentoLabel, ultimaPerguntaLabel,
  consentimentoRow, CONSENTIMENTOS_HEADER, ConsentimentoFornecedor,
} from "@/lib/adminExports";

const base: ConsentimentoFornecedor = {
  id: "1",
  nome: "DESTRINHO",
  representante: "Elvis",
  telefone: "44 99732-7891",
  email: null,
  cnpj: "80334709000162",
  tipo_fornecedor: "geral",
  pasta: ["Mercearia"],
  origem_cadastro: "manual",
  consentimento_rede: "sim",
  consentimento_ultima_pergunta: "2026-09-21T14:04:00.000Z",
  consentimento_recusas: 0,
  cadastros: 4,
  clientes: 4,
  lojas_vinculadas: 4,
  cidades: ["Cianorte", "Maringá"],
  created_at: "2026-09-01T10:00:00.000Z",
};

describe("formatCnpjBR", () => {
  it("aplica a máscara com 14 dígitos", () => {
    expect(formatCnpjBR("80334709000162")).toBe("80.334.709/0001-62");
  });
  it("devolve vazio sem CNPJ", () => {
    expect(formatCnpjBR(null)).toBe("");
  });
  it("não mascara CNPJ incompleto", () => {
    expect(formatCnpjBR("8033470")).toBe("8033470");
  });
});

describe("consentimentoLabel", () => {
  it("traduz os três estados", () => {
    expect(consentimentoLabel("sim")).toBe("Participa");
    expect(consentimentoLabel("nao")).toBe("Recusou");
    expect(consentimentoLabel("pendente")).toBe("Pendente");
    expect(consentimentoLabel(null)).toBe("Pendente");
  });
});

describe("ultimaPerguntaLabel", () => {
  it("avisa quando nunca foi perguntado", () => {
    expect(ultimaPerguntaLabel(null)).toBe("Ainda não perguntado");
  });
  it("mostra data com hora", () => {
    expect(ultimaPerguntaLabel("2026-09-21T14:04:00.000Z")).toMatch(/21\/09\/2026 às \d{2}:\d{2}/);
  });
});

describe("consentimentoRow", () => {
  it("gera a linha na mesma ordem do cabeçalho", () => {
    const row = consentimentoRow(base);
    expect(row).toHaveLength(CONSENTIMENTOS_HEADER.length);
    expect(row[4]).toBe("80.334.709/0001-62");
    expect(row[7]).toBe("Participa");
    expect(row[13]).toBe("Cianorte, Maringá");
  });

  it("trata fornecedor pendente sem CNPJ", () => {
    const row = consentimentoRow({
      ...base, cnpj: null, consentimento_rede: "pendente",
      consentimento_ultima_pergunta: null, cidades: null,
    });
    expect(row[4]).toBe("");
    expect(row[7]).toBe("Pendente");
    expect(row[8]).toBe("Ainda não perguntado");
    expect(row[13]).toBe("");
  });
});
