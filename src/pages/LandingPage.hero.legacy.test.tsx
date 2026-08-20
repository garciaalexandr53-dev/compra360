import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "./LandingPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

class IOStub {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    // Dispara o callback de forma síncrona ao observar — sem setTimeout,
    // garantindo determinismo total nos testes.
    this.cb(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
// @ts-expect-error stub
globalThis.IntersectionObserver = IOStub;

const TEXTOS_ANTIGOS = [
  "Sistema de cotação para supermercado e comércio",
  "Pare de perder dinheiro com cotações lentas",
  "comece a comprar melhor",
  "Compare preços de todos os fornecedores em segundos",
  "Descubra automaticamente o fornecedor mais barato",
  "Nunca mais pague caro sem perceber",
];

describe("LandingPage — Hero não contém textos antigos", () => {
  beforeEach(() => cleanup());

  it.each(TEXTOS_ANTIGOS)("não renderiza o texto antigo: %s", (texto) => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.queryByText(new RegExp(texto, "i"))).not.toBeInTheDocument();
  });
});
