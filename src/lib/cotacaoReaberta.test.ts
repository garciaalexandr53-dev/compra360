import { describe, it, expect } from "vitest";
import { estadoCotacaoReaberta } from "./cotacaoReaberta";

describe("estadoCotacaoReaberta", () => {
  it("cotação reaberta mostra aviso de ajustes", () => {
    const r = estadoCotacaoReaberta({ reaberta_em: "2026-10-13T10:00:00Z" });
    expect(r.reaberta).toBe(true);
    expect(r.titulo).toBe("Cotação reaberta para ajustes");
  });
  it("cotação normal mantém o título de fechamento", () => {
    const r = estadoCotacaoReaberta({ reaberta_em: null });
    expect(r.reaberta).toBe(false);
    expect(r.titulo).toBe("Todos os fornecedores responderam");
    expect(r.subtitulo).toBeNull();
  });
});
