import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrazoCotacaoBadge from "./PrazoCotacaoBadge";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  // Force 360px viewport
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 360 });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });
  window.dispatchEvent(new Event("resize"));
});

describe("PrazoCotacaoBadge — responsive at 360px (Salvar button visible)", () => {
  it("renders popover content with width that fits in 360px viewport and Salvar button is reachable", () => {
    render(<PrazoCotacaoBadge cotacaoId="cot1" prazoIso={null} />);

    // Open popover
    fireEvent.click(screen.getByText(/Sem prazo definido/i));

    // Salvar button must be present in the DOM
    const salvar = screen.getByRole("button", { name: /Salvar/i });
    expect(salvar).toBeInTheDocument();

    // Cancelar must also be visible (sibling in same flex row)
    const cancelar = screen.getByRole("button", { name: /Cancelar/i });
    expect(cancelar).toBeInTheDocument();

    // Popover content uses w-[calc(100vw-1.5rem)] capped at max-w-[280px] — find ancestor element with that class
    const popoverContent = salvar.closest('[class*="calc(100vw-1.5rem)"]');
    expect(popoverContent).not.toBeNull();
    // Ensure max-w prevents overflow on 360px screens
    expect(popoverContent?.className).toMatch(/max-w-\[280px\]/);

    // Both action buttons share a flex container with gap and flex-1 → both stay side by side
    const buttonsRow = salvar.parentElement!;
    expect(buttonsRow.className).toMatch(/flex/);
    expect(salvar.className).toMatch(/flex-1/);
    expect(cancelar.className).toMatch(/flex-1/);
  });
});
