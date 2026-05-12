import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PrazoEditableBadge, { addHoursIso, isoToDatetimeLocal } from "./PrazoEditableBadge";

const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (...args: any[]) => {
        updateMock(...args);
        return { eq: (...a: any[]) => { eqMock(...a); return Promise.resolve({ error: null }); } };
      },
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  updateMock.mockClear();
  eqMock.mockClear();
});

describe("addHoursIso", () => {
  it("adds hours from a base time", () => {
    const base = new Date("2025-01-01T10:00:00Z").getTime();
    expect(addHoursIso(2, base)).toBe("2025-01-01T12:00:00.000Z");
    expect(addHoursIso(8, base)).toBe("2025-01-01T18:00:00.000Z");
  });
});

describe("isoToDatetimeLocal", () => {
  it("formats local datetime string", () => {
    const v = isoToDatetimeLocal(new Date(2025, 0, 5, 9, 30).toISOString());
    expect(v).toBe("2025-01-05T09:30");
  });
});

describe("PrazoEditableBadge", () => {
  it("renders edit button", () => {
    wrap(<PrazoEditableBadge cotacaoId="c1" prazoIso={null} />);
    expect(screen.getByLabelText(/Editar prazo/i)).toBeInTheDocument();
  });

  it("opens popover with quick options", () => {
    wrap(<PrazoEditableBadge cotacaoId="c1" prazoIso={null} />);
    fireEvent.click(screen.getByLabelText(/Editar prazo/i));
    expect(screen.getByText("+1h")).toBeInTheDocument();
    expect(screen.getByText("+2h")).toBeInTheDocument();
    expect(screen.getByText("+4h")).toBeInTheDocument();
    expect(screen.getByText("+8h")).toBeInTheDocument();
  });

  it("saves +Xh as ISO offset from now", async () => {
    wrap(<PrazoEditableBadge cotacaoId="c1" prazoIso={null} />);
    fireEvent.click(screen.getByLabelText(/Editar prazo/i));
    const before = Date.now();
    fireEvent.click(screen.getByText("+4h"));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const arg = updateMock.mock.calls[0][0] as any;
    const ms = new Date(arg.prazo_resposta).getTime();
    expect(ms - before).toBeGreaterThanOrEqual(4 * 3600 * 1000 - 1000);
    expect(ms - before).toBeLessThanOrEqual(4 * 3600 * 1000 + 5000);
    expect(eqMock).toHaveBeenCalledWith("id", "c1");
  });

  it("shows Remove only when prazo is set, and sends null", async () => {
    const iso = new Date(Date.now() + 3600_000).toISOString();
    wrap(<PrazoEditableBadge cotacaoId="c1" prazoIso={iso} />);
    fireEvent.click(screen.getByLabelText(/Editar prazo/i));
    fireEvent.click(screen.getByText(/Remover prazo/i));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect((updateMock.mock.calls[0][0] as any).prazo_resposta).toBeNull();
  });

  it("hides Remove when no prazo is set", () => {
    wrap(<PrazoEditableBadge cotacaoId="c1" prazoIso={null} />);
    fireEvent.click(screen.getByLabelText(/Editar prazo/i));
    expect(screen.queryByText(/Remover prazo/i)).not.toBeInTheDocument();
  });
});
