import { describe, it, expect } from "vitest";
import {
  mensagemConfirmacaoCadastro,
  mensagemAcessoParceiro,
  linkSuporteComMensagem,
  linkParceiro,
} from "./parceiro";

describe("parceiro", () => {
  it("monta a mensagem de confirmação com representante, empresa e código", () => {
    const msg = mensagemConfirmacaoCadastro("João Silva", "Distribuidora Sol", "4821");
    expect(msg).toContain("João Silva da Distribuidora Sol");
    expect(msg).toContain("4821");
  });

  it("funciona sem representante informado", () => {
    expect(mensagemConfirmacaoCadastro("", "Sol", "1234")).toContain("Sol");
  });

  it("monta a mensagem de atualização de dados", () => {
    expect(mensagemAcessoParceiro("Sol", "9314")).toContain("9314");
  });

  it("codifica a mensagem no link do WhatsApp do suporte", () => {
    const url = linkSuporteComMensagem("Olá Compra360! Código: 1111");
    expect(url.startsWith("https://wa.me/5544984483553?text=")).toBe(true);
    expect(url).toContain("C%C3%B3digo");
  });

  it("monta o link exclusivo do parceiro", () => {
    expect(linkParceiro("abc123", "https://compra360app.com.br/")).toBe(
      "https://compra360app.com.br/parceiro/abc123",
    );
  });
});
