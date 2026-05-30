import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FornecedorCotacaoPage from "./FornecedorCotacaoPage";

/**
 * Integration tests guaranteeing FornecedorCotacaoPage loads products
 * EXCLUSIVELY through the SECURITY DEFINER RPC `get_supplier_cotacao_produtos`,
 * scoped to the supplier token. No direct table access to `cotacao_produtos`,
 * `produtos`, or `categorias` is allowed.
 */

const FUTURE_PRAZO = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

const supplierRow = { id: "sup-1", nome: "Distribuidora ACME" };
const statusRow = {
  cotacao_id: "cot-1",
  status: "ativa",
  prazo_resposta: FUTURE_PRAZO,
  loja_nome: "Loja Centro",
};
const cpRows = [
  { id: "cp1", quantidade: 5, fator_embalagem: 1, produto_nome: "Arroz 5kg", produto_embalagem: "fd" },
  { id: "cp2", quantidade: 2, fator_embalagem: 12, produto_nome: "Refrigerante 2L", produto_embalagem: "cx" },
];

// Spy that captures every RPC invocation with its args
const rpcSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: any) => {
      rpcSpy(fn, args);
      if (fn === "get_supplier_info") {
        // Only the valid token resolves to a supplier; everything else returns []
        return Promise.resolve({
          data: args?._token === "valid-token" ? [supplierRow] : [],
          error: null,
        });
      }
      if (fn === "get_cotacao_status_for_supplier") {
        return Promise.resolve({
          data: args?._token === "valid-token" ? [statusRow] : [],
          error: null,
        });
      }
      if (fn === "marcar_cotacao_visualizada") return Promise.resolve({ error: null });
      if (fn === "get_supplier_cotacao_produtos") {
        // Server-side guard: only returns rows when the token is bound to that cotação
        return Promise.resolve({
          data: args?._token === "valid-token" ? cpRows : [],
          error: null,
        });
      }
      if (fn === "get_supplier_existing_prices") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    },
    // Fails the test loudly if the page tries to bypass RPC and hit a table directly
    from: () => {
      throw new Error("Direct table access detected — must go through SECURITY DEFINER RPC");
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderWith = (token: string) =>
  render(
    <MemoryRouter initialEntries={[`/f/${token}`]}>
      <Routes>
        <Route path="/f/:token" element={<FornecedorCotacaoPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  rpcSpy.mockClear();
});

describe("FornecedorCotacaoPage — acesso a produtos via RPC token-only", () => {
  it("carrega produtos chamando get_supplier_cotacao_produtos com o token do fornecedor", async () => {
    renderWith("valid-token");

    await waitFor(() => expect(screen.getByText(/Arroz 5kg/)).toBeInTheDocument());
    expect(screen.getByText(/Refrigerante 2L/)).toBeInTheDocument();

    // RPC must have been called with the supplier token + cotacao_id
    expect(rpcSpy).toHaveBeenCalledWith("get_supplier_cotacao_produtos", {
      _token: "valid-token",
      _cotacao_id: "cot-1",
    });
  });

  it("não realiza acesso direto a cotacao_produtos/produtos/categorias", async () => {
    renderWith("valid-token");
    await waitFor(() => expect(screen.getByText(/Arroz 5kg/)).toBeInTheDocument());

    const tableCalls = rpcSpy.mock.calls.map(([fn]) => fn);
    // All product reads must go through the SECURITY DEFINER RPC
    expect(tableCalls).toContain("get_supplier_cotacao_produtos");
    // If `.from()` had been called, the mock would have thrown and failed the test
  });

  it("com token inválido mostra tela 'Link inválido' e nunca chama get_supplier_cotacao_produtos", async () => {
    renderWith("bad-token");

    await waitFor(() => expect(screen.getByText(/Link inválido/i)).toBeInTheDocument());

    const calledFns = rpcSpy.mock.calls.map(([fn]) => fn);
    expect(calledFns).toContain("get_supplier_info");
    expect(calledFns).not.toContain("get_supplier_cotacao_produtos");
  });
});
