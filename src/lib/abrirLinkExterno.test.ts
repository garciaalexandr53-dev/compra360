import { describe, expect, it, vi } from "vitest";
import { abrirLinkExterno } from "./abrirLinkExterno";

const URL_CHECKOUT = "https://checkout.stripe.com/c/pay/cs_test_abc123";

describe("abrirLinkExterno", () => {
  it("abre em nova aba quando o navegador permite, sem redirecionar a janela", () => {
    const redirecionar = vi.fn();
    const aba = { opener: {} } as unknown as Window;
    const abrir = vi.fn(() => aba);

    abrirLinkExterno(URL_CHECKOUT, { abrir, redirecionar });

    expect(abrir).toHaveBeenCalledWith(URL_CHECKOUT);
    expect(redirecionar).not.toHaveBeenCalled();
    expect(aba.opener).toBeNull();
  });

  it("redireciona a própria janela quando o pop-up é bloqueado", () => {
    const redirecionar = vi.fn();

    abrirLinkExterno(URL_CHECKOUT, { abrir: () => null, redirecionar });

    expect(redirecionar).toHaveBeenCalledWith(URL_CHECKOUT);
  });

  it("redireciona a própria janela quando o navegador lança erro ao abrir a aba", () => {
    const redirecionar = vi.fn();

    abrirLinkExterno(URL_CHECKOUT, {
      abrir: () => {
        throw new Error("pop-up bloqueado");
      },
      redirecionar,
    });

    expect(redirecionar).toHaveBeenCalledWith(URL_CHECKOUT);
  });

  it("falha quando o servidor não retorna a URL do pagamento", () => {
    expect(() =>
      abrirLinkExterno("", { abrir: () => null, redirecionar: vi.fn() }),
    ).toThrow("URL não retornada");
  });
});
