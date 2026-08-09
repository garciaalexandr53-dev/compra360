import { describe, it, expect } from "vitest";
import { avaliarPreco } from "./avaliarPreco";

describe("avaliarPreco", () => {
  it("alerta quando divergência é maior que 20% (acima e abaixo)", () => {
    expect(avaliarPreco(20, 10, "global").alerta).toBe(true);
    expect(avaliarPreco(0.93, 93, "global").alerta).toBe(true);
  });

  it("não alerta dentro da tolerância de 20%", () => {
    expect(avaliarPreco(11.5, 10, "comprador")).toEqual({ alerta: false, mensagem: null });
    expect(avaliarPreco(8.5, 10, "comprador")).toEqual({ alerta: false, mensagem: null });
    expect(avaliarPreco(12, 10, "global").alerta).toBe(false);
  });

  it("gera mensagens diferentes para cada origem", () => {
    const global = avaliarPreco(20, 10, "global");
    const comprador = avaliarPreco(20, 10, "comprador");
    expect(global.mensagem).toContain("preço de mercado");
    expect(comprador.mensagem).toContain("cotações anteriores com você");
    expect(global.mensagem).not.toBe(comprador.mensagem);
  });

  it("sem referência cai na faixa fixa", () => {
    expect(avaliarPreco(0.3, null, null)).toEqual({
      alerta: true,
      mensagem: "Valor incomum — confirme se está correto",
    });
    expect(avaliarPreco(1500, null, null).alerta).toBe(true);
    expect(avaliarPreco(46.45, null, null)).toEqual({ alerta: false, mensagem: null });
  });

  it("ignora preços vazios ou zero", () => {
    expect(avaliarPreco(0, 10, "global").alerta).toBe(false);
    expect(avaliarPreco(NaN, null, null).alerta).toBe(false);
  });
});
