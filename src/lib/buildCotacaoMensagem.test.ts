import { describe, it, expect } from "vitest";
import { buildCotacaoMensagem } from "./format";

const futuro = new Date(Date.now() + 3 * 864e5).toISOString();

describe("buildCotacaoMensagem", () => {
  it("identifica a loja na mensagem", () => {
    const m = buildCotacaoMensagem({ fornecedorNome: "ATACADAO", lojaNome: "Mercado Moura", link: "https://x/l" });
    expect(m).toContain("Aqui é do *Mercado Moura*");
  });
  it("inclui o prazo quando definido", () => {
    const m = buildCotacaoMensagem({ fornecedorNome: "A", lojaNome: "L", link: "x", prazoIso: futuro });
    expect(m).toContain("Fechamento da cotação");
  });
  it("lembrete também identifica a loja", () => {
    const m = buildCotacaoMensagem({ fornecedorNome: "A", lojaNome: "Mercado Moura", link: "x", lembrete: true });
    expect(m).toContain("Mercado Moura");
    expect(m).toContain("ainda não preencheu");
  });
});
