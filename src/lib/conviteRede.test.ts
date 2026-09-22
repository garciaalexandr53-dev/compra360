import { describe, it, expect } from "vitest";
import { montarConviteRede, LINK_REDE_PARCEIRO } from "./conviteRede";

describe("montarConviteRede", () => {
  it("usa a voz institucional do Compra360 e inclui o link da Rede", () => {
    const msg = montarConviteRede();
    expect(msg).toContain("O Compra360 é a plataforma");
    expect(msg).toContain("Rede de Fornecedores Parceiros");
    expect(msg).toContain("Sem mensalidade, sem comissão");
    expect(msg).toContain(LINK_REDE_PARCEIRO);
  });

  it("personaliza a saudação quando há nome", () => {
    expect(montarConviteRede("Distribuidora Sul")).toContain("Olá, Distribuidora Sul!");
  });

  it("aponta para a página com prévia de compartilhamento", () => {
    expect(LINK_REDE_PARCEIRO).toBe("https://compra360app.com.br/rede");
  });
});
