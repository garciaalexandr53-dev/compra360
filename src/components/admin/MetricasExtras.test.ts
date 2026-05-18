import { describe, it, expect } from "vitest";
import { buildGrowthData } from "./MetricasExtras";
import type { Cliente } from "@/lib/adminHelpers";

function makeCliente(daysAgo: number): Cliente {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    user_id: `u-${daysAgo}`,
    email: "x@x.com",
    created_at: d.toISOString(),
    loja_principal: null,
    cnpj: null,
    whatsapp: null,
    total_lojas: 0,
    total_produtos: 0,
    total_produtos_inativos: 0,
    total_fornecedores: 0,
    total_cotacoes: 0,
    total_pedidos: 0,
    plan_name: "free",
    plan_status: "active",
    trial_end: null,
    ultima_cotacao_at: null,
  };
}

describe("buildGrowthData", () => {
  it("retorna 8 pontos por padrão", () => {
    const data = buildGrowthData([]);
    expect(data).toHaveLength(8);
    expect(data[0].semana).toBe("Sem 1");
    expect(data[7].semana).toBe("Sem 8");
  });

  it("conta usuários acumulados por semana", () => {
    const clientes = [
      makeCliente(0),   // hoje -> conta em todas semanas finais
      makeCliente(10),  // ~semana 7
      makeCliente(60),  // antes de tudo
    ];
    const data = buildGrowthData(clientes);
    // A semana mais antiga só tem o de 60 dias atrás
    expect(data[0].total).toBe(1);
    // A última semana tem todos
    expect(data[7].total).toBe(3);
  });
});
