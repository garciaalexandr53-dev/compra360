import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImportErpModal from "./ImportErpModal";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

const csv = [
  "RELATORIO DE SUGESTAO DE COMPRA",
  "Emitido em 30/09/2026",
  "",
  "CD_ITEM;DESCRICAO_ITEM;QT_SUGESTAO;UM;FATOR;CD_EAN",
  "1001;ARROZ TIPO 1 5KG;10;FD;6;7891234567890",
  "1002;REFRIGERANTE COLA 2L;4;CX;12;7899999999999",
].join("\n");

const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ImportErpModal open onOpenChange={() => {}} cotacaoId="c1" />
    </QueryClientProvider>,
  );

describe("ImportErpModal — fluxo de 3 etapas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sobe a planilha, reconhece as colunas e chega na revisão", async () => {
    renderModal();
    expect(screen.getByText(/Clique ou arraste o arquivo/i)).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([csv], "sugestao.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", {
      value: () => Promise.resolve(new TextEncoder().encode(csv).buffer),
    });
    fireEvent.change(input, { target: { files: [file] } });

    // etapa 2: mapeamento com colunas reconhecidas
    await waitFor(() => expect(screen.getByText(/Confira o que é cada coluna/i)).toBeInTheDocument());
    expect(screen.getByText("Produto ✓")).toBeInTheDocument();
    expect(screen.getByText("Quantidade ✓")).toBeInTheDocument();
    expect(screen.getByText("Qtd. por embalagem (fator) ✓")).toBeInTheDocument();
    expect(screen.getByText("Código de barras (EAN) ✓")).toBeInTheDocument();

    const avancar = screen.getByRole("button", { name: /Avançar/i });
    expect(avancar).not.toBeDisabled();
    fireEvent.click(avancar);

    // etapa 3: revisão com os itens e o fator detectado
    await waitFor(() => expect(screen.getByText("2 itens prontos")).toBeInTheDocument());
    expect(screen.getByText("ARROZ TIPO 1 5KG")).toBeInTheDocument();
    expect(screen.getByText("REFRIGERANTE COLA 2L")).toBeInTheDocument();
    expect(screen.getByText("6 un/emb.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar 2 itens/i })).toBeInTheDocument();
  });
});
