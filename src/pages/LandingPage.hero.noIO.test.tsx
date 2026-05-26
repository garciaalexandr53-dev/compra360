import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

describe("LandingPage — Hero sem IntersectionObserver", () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    cleanup();
    originalIO = globalThis.IntersectionObserver;
    // Simula um ambiente sem suporte a IntersectionObserver.
    // @ts-expect-error remoção intencional para teste
    delete globalThis.IntersectionObserver;
  });

  afterEach(() => {
    if (originalIO) {
      globalThis.IntersectionObserver = originalIO;
    }
  });

  it("renderiza sem lançar erro mesmo sem IntersectionObserver", () => {
    expect(typeof globalThis.IntersectionObserver).toBe("undefined");
    expect(() =>
      render(
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  it("renderiza o h1 do Hero como fallback visível", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent?.trim()).toBe(
      "Sua empresa pode estar pagando mais caro sem perceber."
    );
  });

  it("renderiza o subtítulo e parágrafo do Hero sem IntersectionObserver", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText("Economize tempo e dinheiro nas compras da sua empresa")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "O Compra360 reúne fornecedores em uma única tela para encontrar a melhor compra em minutos."
      )
    ).toBeInTheDocument();
  });
});
