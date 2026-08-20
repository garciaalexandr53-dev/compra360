import { describe, it, expect } from "vitest";
import { buildSuporteUrl, SUPORTE_WHATSAPP } from "@/lib/suporte";

describe("buildSuporteUrl", () => {
  it("normaliza o número de WhatsApp", () => {
    expect(SUPORTE_WHATSAPP).toMatch(/^\d{11}$/);
  });

  it("monta a URL com mensagem pré-preenchida", () => {
    const url = buildSuporteUrl({ nome: "Loja Teste", email: "teste@exemplo.com", plano: "Pro", loja: "Matriz" });
    expect(url).toContain("https://api.whatsapp.com/send?phone=5544984483553&text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Olá! Sou usuário do Compra360 e preciso de ajuda.");
    expect(decoded).toContain("Nome: Loja Teste");
    expect(decoded).toContain("E-mail: teste@exemplo.com");
    expect(decoded).toContain("Plano: Pro");
    expect(decoded).toContain("Loja: Matriz");
  });

  it("ignora campos ausentes", () => {
    const url = buildSuporteUrl({ email: "teste@exemplo.com" });
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("E-mail: teste@exemplo.com");
    expect(decoded).not.toContain("Nome:");
    expect(decoded).not.toContain("Plano:");
    expect(decoded).not.toContain("Loja:");
  });

  it("retorna URL mesmo com todos os campos vazios", () => {
    const url = buildSuporteUrl({});
    expect(url).toContain("https://api.whatsapp.com/send?phone=5544984483553&text=");
    expect(decodeURIComponent(url)).toContain("Olá! Sou usuário do Compra360 e preciso de ajuda.");
  });
});
