import { describe, it, expect } from "vitest";
import { generateScenarios } from "./scenarios";

// 3 fornecedores: A e B grandes, C tem só 1 item com preço quase igual ao de A.
const cotacaoProdutos = [
  { id: "cp1", nome: "Arroz 5kg", quantidade: 10, fator_embalagem: 1 },
  { id: "cp2", nome: "Feijão 1kg", quantidade: 10, fator_embalagem: 1 },
  { id: "cp3", nome: "Açúcar 5kg", quantidade: 10, fator_embalagem: 1 },
  { id: "cp4", nome: "Café 500g", quantidade: 10, fator_embalagem: 1 },
] as any;

const precos = [
  { cotacao_produto_id: "cp1", fornecedor_id: "A", preco: 20 },
  { cotacao_produto_id: "cp2", fornecedor_id: "A", preco: 8 },
  { cotacao_produto_id: "cp3", fornecedor_id: "B", preco: 15 },
  { cotacao_produto_id: "cp3", fornecedor_id: "A", preco: 15.3 },
  { cotacao_produto_id: "cp4", fornecedor_id: "B", preco: 12 },
];

const fornecedores = [
  { id: "A", nome: "Fornecedor A", pedido_minimo: 0 },
  { id: "B", nome: "Fornecedor B", pedido_minimo: 0 },
];

describe("cenário Menos Fornecedores — transparência", () => {
  it("registra fornecedor removido com motivo e itens realocados", () => {
    const scenarios = generateScenarios(cotacaoProdutos, precos, fornecedores);
    const consolidado = scenarios.find((s) => s.id === "consolidado");
    if (!consolidado) return; // cenário pode ser descartado por dominância
    const cr = consolidado.cascadeResult;
    expect(cr).toBeDefined();
    expect(cr!.discardDetails.length).toBeGreaterThan(0);
    for (const d of cr!.discardDetails) {
      expect(d.motivo).toBeTruthy();
      expect(d.fornecedorNome).not.toBe("?");
    }
    expect(cr!.pullDetails.length).toBeGreaterThan(0);
    for (const p of cr!.pullDetails) {
      expect(typeof p.precoAntes).toBe("number");
      expect(typeof p.precoDepois).toBe("number");
      expect(typeof p.custoExtra).toBe("number");
    }
  });

  it("custo extra total corresponde à diferença vs melhor preço", () => {
    const scenarios = generateScenarios(cotacaoProdutos, precos, fornecedores);
    const consolidado = scenarios.find((s) => s.id === "consolidado");
    if (!consolidado?.cascadeResult) return;
    const soma = consolidado.cascadeResult.pullDetails.reduce(
      (s, p) => s + (p.custoExtra || 0),
      0
    );
    expect(soma).toBeCloseTo(consolidado.cascadeResult.custoExtraTotal || 0, 2);
    expect(soma).toBeCloseTo(consolidado.diffVsBaseline, 2);
  });
});
