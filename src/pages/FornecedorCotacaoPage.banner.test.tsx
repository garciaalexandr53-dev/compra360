import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FornecedorCotacaoPage from "./FornecedorCotacaoPage";

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
  { id: "cp1", quantidade: 2, fator_embalagem: 12, produto_nome: "Produto A", produto_embalagem: "Dz" },
  { id: "cp2", quantidade: 3, fator_embalagem: 6, produto_nome: "Produto B", produto_embalagem: "Pct" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string) => {
      if (fn === "get_supplier_info") return Promise.resolve({ data: [supplierRow], error: null });
      if (fn === "get_cotacao_status_for_supplier") return Promise.resolve({ data: [statusRow], error: null });
      if (fn === "marcar_cotacao_visualizada") return Promise.resolve({ error: null });
      if (fn === "get_supplier_cotacao_produtos") return Promise.resolve({ data: cpRows, error: null });
      if (fn === "get_supplier_existing_prices") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    },
    from: () => {
      throw new Error("Direct table access is forbidden — must go through RPC");
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/f/tok123"]}>
      <Routes>
        <Route path="/f/:token" element={<FornecedorCotacaoPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe("FornecedorCotacaoPage — banner com countdown", () => {
  it("renders deadline banner with hour and countdown when prazo_resposta is set", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Produto A/)).toBeInTheDocument());
    expect(screen.getByText(/Envie seus preços até as/i)).toBeInTheDocument();
    expect(screen.getByText(/faltam/i)).toBeInTheDocument();
  });
});
