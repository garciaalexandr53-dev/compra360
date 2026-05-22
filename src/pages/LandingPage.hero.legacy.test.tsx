import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

class IOStub {
  constructor(cb: IntersectionObserverCallback) {
    setTimeout(
      () =>
        cb(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        ),
      0
    );
  }
  observe() {}
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
