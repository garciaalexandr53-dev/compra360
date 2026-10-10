import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { obterPrazoCotacao, lojaPronta } from "./prazoCotacao";

describe("obterPrazoCotacao", () => {
  it("usa o prazo já carregado sem consultar o banco", async () => {
    const buscar = vi.fn();
    expect(await obterPrazoCotacao("2026-10-11T01:15:00Z", "l1", buscar)).toBe("2026-10-11T01:15:00Z");
    expect(buscar).not.toHaveBeenCalled();
  });
  it("busca no banco quando a tela ainda não tem o prazo", async () => {
    const buscar = vi.fn().mockResolvedValue("2026-10-11T01:15:00Z");
    expect(await obterPrazoCotacao(undefined, "l1", buscar)).toBe("2026-10-11T01:15:00Z");
    expect(buscar).toHaveBeenCalledWith("l1");
  });
});

describe("lojaPronta", () => {
  it("espera a loja carregar antes de consultar a cotação", () => {
    expect(lojaPronta(true, [], null)).toBe(false);
    expect(lojaPronta(false, [{}], null)).toBe(false);
    expect(lojaPronta(false, [{}], {})).toBe(true);
    expect(lojaPronta(false, [], null)).toBe(true);
  });
});
