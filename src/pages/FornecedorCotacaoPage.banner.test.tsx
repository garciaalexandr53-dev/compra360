import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FornecedorCotacaoPage from "./FornecedorCotacaoPage";

// Build a prazo that is 2h ahead of "now" so countdown shows hours
const FUTURE_PRAZO = (() => {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return d.toISOString();
})();

const supplierRow = { id: "sup1", nome: "Fornecedor Teste" };
const statusRow = {
  cotacao_id: "cot1",
  status: "ativa",
  prazo_resposta: FUTURE_PRAZO,
  loja_nome: "Loja Centro",
};

const cpRows = [
  {
    id: "cp1",
    quantidade: 2,
    fator_embalagem: 12,
    produtos: { nome: "Produto A", embalagem: "Dz" },
  },
  {
    id: "cp2",
    quantidade: 3,
    fator_embalagem: 6,
    produtos: { nome: "Produto B", embalagem: "Pct" },
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
  };
  return {
    supabase: {
      rpc: (fn: string) => {
        if (fn === "get_supplier_info") return Promise.resolve({ data: [supplierRow], error: null });
        if (fn === "get_cotacao_status_for_supplier")
          return Promise.resolve({ data: [statusRow], error: null });
        if (fn === "marcar_cotacao_visualizada") return Promise.resolve({ error: null });
        return Promise.resolve({ data: null, error: null });
      },
      from: (table: string) => {
        if (table === "cotacao_produtos") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: cpRows, error: null }),
            }),
          };
        }
        if (table === "precos") {
          return {
            select: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        return {} as any;
      },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/f/tok123"]}>
      <Routes>
        <Route path="/f/:token" element={<FornecedorCotacaoPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FornecedorCotacaoPage — banner com countdown", () => {
  it("renders deadline banner with hour and countdown when prazo_resposta is set", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Produto A/)).toBeInTheDocument());

    // Banner text contains "Envie seus preços até as" and "faltam"
    expect(screen.getByText(/Envie seus preços até as/i)).toBeInTheDocument();
    expect(screen.getByText(/faltam/i)).toBeInTheDocument();
  });
});

describe("FornecedorCotacaoPage — contagem de itens (quantidade × fator)", () => {
  it("displays total units (quantidade × fator) instead of quantidade only", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Produto A/)).toBeInTheDocument());

    // 2 × 12 = 24 un
    expect(screen.getByText(/Dz · 24 un/)).toBeInTheDocument();
    // 3 × 6 = 18 un
    expect(screen.getByText(/Pct · 18 un/)).toBeInTheDocument();
  });
});
