import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

class IOStub {
  constructor(cb: IntersectionObserverCallback) {
    cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}
// @ts-expect-error stub
globalThis.IntersectionObserver = IOStub;

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage — textos do Hero", () => {
  beforeEach(() => cleanup());

  it("renderiza o subtítulo do Hero exatamente como especificado", () => {
    renderPage();
    expect(
      screen.getByText("Economize tempo e dinheiro nas compras da sua empresa")
    ).toBeInTheDocument();
  });

  it("renderiza o h1 do Hero exatamente como especificado", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent?.trim()).toBe(
      "Sua empresa pode estar pagando mais caro sem perceber."
    );
  });

  it("renderiza o parágrafo descritivo do Hero exatamente como especificado", () => {
    renderPage();
    expect(
      screen.getByText(
        "O Compra360 reúne fornecedores em uma única tela para encontrar a melhor compra em minutos."
      )
    ).toBeInTheDocument();
  });

  it("renderiza os três bullets do Hero exatamente como especificado", () => {
    renderPage();
    expect(
      screen.getByText("Compare preços de vários fornecedores em segundos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Descubra automaticamente a melhor compra")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Economize sem depender de planilhas ou WhatsApp")
    ).toBeInTheDocument();
  });
});
