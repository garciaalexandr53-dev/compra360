import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrazoCotacaoBadge from "./PrazoCotacaoBadge";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  // Mock current time at 14:00 local while letting timers advance (Radix needs them)
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

describe("PrazoCotacaoBadge — Sem prazo definido", () => {
  it("shows 'Sem prazo definido' label when prazoIso is null", () => {
    render(<PrazoCotacaoBadge cotacaoId="abc" prazoIso={null} />);
    expect(screen.getByText(/Sem prazo definido/i)).toBeInTheDocument();
  });

  it("does not show countdown or expired status when prazoIso is null", () => {
    render(<PrazoCotacaoBadge cotacaoId="abc" prazoIso={null} />);
    expect(screen.queryByText(/expirado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/min/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/⏰/)).not.toBeInTheDocument();
  });
});

describe("PrazoCotacaoBadge — AlertDialog hora passada", () => {
  it("shows current time, chosen time, and impact list when saving past time", async () => {
    render(<PrazoCotacaoBadge cotacaoId="abc" prazoIso={null} />);

    // Open popover
    fireEvent.click(screen.getByText(/Sem prazo definido/i));

    // Uncheck "sem prazo"
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);

    // Set time to 10:00 (past, since now is 14:00)
    const timeInput = screen.getByDisplayValue("18:00") as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: "10:00" } });

    // Click Salvar
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    // AlertDialog visible
    expect(await screen.findByText(/Horário já passou/i)).toBeInTheDocument();

    // Chosen time shown
    expect(screen.getByText(/10:00/)).toBeInTheDocument();

    // Current time (14:00) shown
    expect(screen.getByText(/14:00/)).toBeInTheDocument();

    // Impact list items
    expect(screen.getByText(/expirada/i)).toBeInTheDocument();
    expect(screen.getByText(/não poderão enviar preços/i)).toBeInTheDocument();
    expect(screen.getByText(/reabrir alterando o prazo/i)).toBeInTheDocument();
  });
});
