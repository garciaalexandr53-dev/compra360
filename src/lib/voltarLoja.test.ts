import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  markVoltarLoja,
  signalVoltarIntent,
  consumeVoltarLoja,
  clearVoltarLoja,
} from "./voltarLoja";

describe("voltarLoja helper", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consumeVoltarLoja retorna null quando nada foi marcado", () => {
    expect(consumeVoltarLoja()).toBeNull();
  });

  it("consumeVoltarLoja retorna null sem intent (somente markVoltarLoja)", () => {
    markVoltarLoja("loja-1");
    expect(consumeVoltarLoja()).toBeNull();
    // E deve ter limpado as chaves restantes.
    expect(sessionStorage.getItem("voltar_loja_id")).toBeNull();
    expect(sessionStorage.getItem("voltar_loja_ts")).toBeNull();
  });

  it("consumeVoltarLoja retorna o id quando intent + mark estão presentes e dentro da TTL", () => {
    markVoltarLoja("loja-1");
    signalVoltarIntent();
    expect(consumeVoltarLoja()).toBe("loja-1");
  });

  it("consumeVoltarLoja só funciona uma vez (limpa as chaves)", () => {
    markVoltarLoja("loja-1");
    signalVoltarIntent();
    expect(consumeVoltarLoja()).toBe("loja-1");
    expect(consumeVoltarLoja()).toBeNull();
    expect(sessionStorage.getItem("voltar_loja_id")).toBeNull();
    expect(sessionStorage.getItem("voltar_loja_intent")).toBeNull();
  });

  it("consumeVoltarLoja retorna null quando o timestamp expirou (>2min)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    markVoltarLoja("loja-1");
    signalVoltarIntent();
    // Avança 3 minutos
    vi.setSystemTime(new Date("2026-01-01T00:03:00Z"));
    expect(consumeVoltarLoja()).toBeNull();
  });

  it("markVoltarLoja sobrescreve intent residual de marcações anteriores", () => {
    signalVoltarIntent();
    markVoltarLoja("loja-2");
    // Intent foi limpo, então consume sem novo intent não restaura.
    expect(consumeVoltarLoja()).toBeNull();
  });

  it("clearVoltarLoja remove todas as chaves", () => {
    markVoltarLoja("loja-1");
    signalVoltarIntent();
    clearVoltarLoja();
    expect(sessionStorage.getItem("voltar_loja_id")).toBeNull();
    expect(sessionStorage.getItem("voltar_loja_ts")).toBeNull();
    expect(sessionStorage.getItem("voltar_loja_intent")).toBeNull();
    expect(consumeVoltarLoja()).toBeNull();
  });

  it("nova navegação (markVoltarLoja) reseta TTL e exige novo intent", () => {
    markVoltarLoja("loja-1");
    signalVoltarIntent();
    consumeVoltarLoja(); // restaurou loja-1

    // Usuário abre outra loja, navega
    markVoltarLoja("loja-2");
    // Sem clicar em Voltar, volta para /lojas via menu
    expect(consumeVoltarLoja()).toBeNull();
  });
});
