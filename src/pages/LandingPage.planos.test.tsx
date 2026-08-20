import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "./LandingPage";

// Mocks
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

// IntersectionObserver — força visible imediato chamando o callback com isIntersecting
class IOStub {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    this.cb(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
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
// @ts-expect-error stub global
globalThis.IntersectionObserver = IOStub;

const BADGE = /30 dias grátis/i;

function getPlanCardByName(name: RegExp): HTMLElement {
  const heading = screen.getByRole("heading", { level: 3, name });
  const card = heading.closest("div.rounded-2xl");
  if (!card) throw new Error(`Card não encontrado para ${name}`);
  return card as HTMLElement;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage — badge '30 dias grátis' na seção de planos", () => {
  beforeEach(() => cleanup());

  it("renderiza apenas no card Business (período Mensal default)", () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: /^Mensal$/i }),
    ).toHaveAttribute("aria-pressed", "true");

    const business = getPlanCardByName(/Business/i);
    const gratuito = getPlanCardByName(/^Gratuito$/i);
    const pro = getPlanCardByName(/^Pro$/i);

    expect(within(business).getAllByText(BADGE).length).toBeGreaterThan(0);
    expect(within(gratuito).queryByText(BADGE)).toBeNull();
    expect(within(pro).queryByText(BADGE)).toBeNull();
  });

  it("continua apenas no card Business após alternar para Anual", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Anual/i }));
    expect(
      screen.getByRole("button", { name: /Anual/i }),
    ).toHaveAttribute("aria-pressed", "true");

    const business = getPlanCardByName(/Business/i);
    const gratuito = getPlanCardByName(/^Gratuito$/i);
    const pro = getPlanCardByName(/^Pro$/i);

    expect(within(business).getAllByText(BADGE).length).toBeGreaterThan(0);
    expect(within(gratuito).queryByText(BADGE)).toBeNull();
    expect(within(pro).queryByText(BADGE)).toBeNull();
  });
});
