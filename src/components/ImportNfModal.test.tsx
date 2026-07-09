import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import ImportNfModal from "./ImportNfModal";

const invokeMock = vi.fn();
const insertCotacaoProdutos = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/lib/supabaseHelpers", () => ({
  fetchAllProductsMap: async () =>
    new Map([["arroz 5kg", { id: "prod-1", nome: "Arroz 5kg" }]]),
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "produtos") {
      return {
        insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
      };
    }
    if (table === "cotacoes") {
      return {
        select: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "cot-1" }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "cotacao_produtos") {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        insert: insertCotacaoProdutos,
      };
    }
    return {};
  };
  return {
    supabase: {
      functions: { invoke: (...args: any[]) => invokeMock(...args) },
      from,
    },
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

describe("ImportNfModal — insert em cotacao_produtos", () => {
  beforeEach(() => {
    cleanup();
    invokeMock.mockReset();
    insertCotacaoProdutos.mockClear();
  });

  it("grava nome = produto (não vazio) e inclui tipo_embalagem/fator_embalagem", async () => {
    invokeMock.mockResolvedValue({
      data: {
        result: {
          itens: [
            { produto: "Arroz 5kg", quantidade: 2, preco_unitario: 25, embalagem: "PCT" },
          ],
        },
      },
      error: null,
    });

    render(<ImportNfModal open onOpenChange={() => {}} />);

    const file = new File(["x"], "nf.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // aguarda o step "review"
    const importBtn = await screen.findByRole("button", { name: /Importar 1 itens/i });
    fireEvent.click(importBtn);

    await waitFor(() => expect(insertCotacaoProdutos).toHaveBeenCalled());

    const payload = insertCotacaoProdutos.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).toMatchObject({
      cotacao_id: "cot-1",
      produto_id: "prod-1",
      nome: "Arroz 5kg",
      tipo_embalagem: "PCT",
      fator_embalagem: 1,
      quantidade: 2,
    });
    expect(payload[0].nome.length).toBeGreaterThan(0);
  });
});
