import { describe, it, expect } from "vitest";
import { economiaAnual, dataValidade, horasEconomizadasMes, tempoCotacaoMin } from "./propostaComercial";

describe("proposta comercial", () => {
  it("economia do anual = mensal×12 + implantação − anual", () => {
    expect(economiaAnual({ anual: 2490, mensal: 290, implantacao: 500 })).toBe(1490);
  });
  it("economia nunca negativa", () => {
    expect(economiaAnual({ anual: 5000, mensal: 100, implantacao: 0 })).toBe(0);
  });
  it("validade de 7 dias", () => {
    expect(dataValidade(new Date(2026, 9, 4), 7).getDate()).toBe(11);
  });
  it("horas economizadas: 180 itens, 3 lojas, 2x/semana", () => {
    // antes = (60+270)*3 = 990 min; economiza 945 min × 2 × 4,3 = 8127 min ≈ 135 h
    expect(tempoCotacaoMin(180, 3).antes).toBe(990);
    expect(horasEconomizadasMes({ itensPorCotacao: 180, lojas: 3, cotacoesPorSemana: 2 })).toBe(135);
  });
});
