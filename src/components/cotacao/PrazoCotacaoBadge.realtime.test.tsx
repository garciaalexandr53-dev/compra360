import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PrazoCotacaoBadge from "./PrazoCotacaoBadge";

const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: updateMock }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  updateMock.mockClear();
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
});

describe("PrazoCotacaoBadge — realtime update após salvar", () => {
  it("calls onChange after saving and re-renders with new prazo on reload", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PrazoCotacaoBadge cotacaoId="cot1" prazoIso={null} onChange={onChange} />
    );

    // Initially shows "Sem prazo definido"
    expect(screen.getByText(/Sem prazo definido/i)).toBeInTheDocument();

    // Open popover
    fireEvent.click(screen.getByText(/Sem prazo definido/i));

    // Uncheck "sem prazo"
    fireEvent.click(screen.getByRole("checkbox"));

    // Set time 18:00 (future relative to 10:00)
    const timeInput = screen.getByDisplayValue("18:00") as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: "18:00" } });

    // Save
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });

    // Simulate "reload" with new prazo coming from refetched data
    const newPrazo = (() => {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      return d.toISOString();
    })();
    rerender(<PrazoCotacaoBadge cotacaoId="cot1" prazoIso={newPrazo} onChange={onChange} />);

    // Badge now shows the new time, no longer "Sem prazo definido"
    expect(screen.queryByText(/Sem prazo definido/i)).not.toBeInTheDocument();
    expect(screen.getByText(/18:00/)).toBeInTheDocument();
  });
});
