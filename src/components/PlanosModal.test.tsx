import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import PlanosModal from "./PlanosModal";

// Mocks mínimos para isolar o componente
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ plan: { plan_name: "free" } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const BADGE = /30 dias grátis/i;

function getCard(name: RegExp) {
  // O nome do plano está num <h3>; subimos até o card (div com border)
  const heading = screen.getByRole("heading", { level: 3, name });
  const card = heading.closest("div.rounded-lg");
  if (!card) throw new Error(`Card não encontrado para ${name}`);
  return card as HTMLElement;
}

describe("PlanosModal — badge '30 dias grátis'", () => {
  beforeEach(() => cleanup());

  it("renderiza no card Business e NÃO nos cards Grátis/Pro (período Mensal)", () => {
    render(<PlanosModal open onClose={() => {}} />);

    // sanity: período default é mensal
    expect(
      screen.getByRole("button", { name: /^Mensal$/i }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(within(getCard(/Business/i)).getByText(BADGE)).toBeInTheDocument();
    expect(within(getCard(/Grátis/i)).queryByText(BADGE)).toBeNull();
    expect(within(getCard(/^Pro$/i)).queryByText(BADGE)).toBeNull();

    // No total, exatamente 1 badge na tela
    expect(screen.getAllByText(BADGE)).toHaveLength(1);
  });

  it("continua renderizando apenas no card Business após alternar para Anual", () => {
    render(<PlanosModal open onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Anual/i }));
    expect(
      screen.getByRole("button", { name: /Anual/i }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(within(getCard(/Business/i)).getByText(BADGE)).toBeInTheDocument();
    expect(within(getCard(/Grátis/i)).queryByText(BADGE)).toBeNull();
    expect(within(getCard(/^Pro$/i)).queryByText(BADGE)).toBeNull();
    expect(screen.getAllByText(BADGE)).toHaveLength(1);
  });
});
