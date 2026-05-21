import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LojaSheet from "./LojaSheet";
import BackToLojaButton from "@/components/shared/BackToLojaButton";
import type { Loja, LojaMetrics } from "./lojaUtils";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const loja: Loja = {
  id: "loja-1",
  nome: "Loja Centro",
  nome_fantasia: null,
  razao_social: null,
  cnpj: null,
  inscricao_estadual: null,
  endereco: null,
  telefone: null,
  created_at: new Date().toISOString(),
  user_id: null,
} as unknown as Loja;

const metrics: LojaMetrics = {
  produtosAtivos: 10,
  fornecedoresVinculados: 3,
  cotacoesMes: 2,
  ultimaCotacaoAt: null,
  ultimaCotacaoId: null,
  cotacaoAtivaId: null,
} as unknown as LojaMetrics;

const renderSheet = () =>
  render(
    <MemoryRouter>
      <LojaSheet
        loja={loja}
        open
        onOpenChange={() => {}}
        ativaId="loja-1"
        metrics={metrics}
        loadingMetrics={false}
        onActivate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </MemoryRouter>
  );

describe("LojaSheet — navegação com state fromLoja", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    sessionStorage.clear();
  });

  it("ao clicar em 'Produtos ativos' navega para /produtos com state.fromLoja", () => {
    renderSheet();
    fireEvent.click(screen.getByText(/Produtos ativos/i).closest("button")!);
    expect(navigateMock).toHaveBeenCalledWith("/produtos", {
      state: { fromLoja: true, lojaId: "loja-1", lojaName: "Loja Centro" },
    });
  });

  it("ao clicar em 'Fornecedores' navega para /fornecedores com state.fromLoja", () => {
    renderSheet();
    fireEvent.click(screen.getByText(/Fornecedores/i).closest("button")!);
    expect(navigateMock).toHaveBeenCalledWith("/fornecedores", {
      state: { fromLoja: true, lojaId: "loja-1", lojaName: "Loja Centro" },
    });
  });

  it("ao clicar em 'Cotações do mês' navega para /historico com state.fromLoja", () => {
    renderSheet();
    fireEvent.click(screen.getByText(/Cotações do mês/i).closest("button")!);
    expect(navigateMock).toHaveBeenCalledWith("/historico", {
      state: { fromLoja: true, lojaId: "loja-1", lojaName: "Loja Centro" },
    });
  });

  it("registra voltar_loja_id no sessionStorage ao navegar", () => {
    renderSheet();
    fireEvent.click(screen.getByText(/Produtos ativos/i).closest("button")!);
    expect(sessionStorage.getItem("voltar_loja_id")).toBe("loja-1");
    expect(sessionStorage.getItem("voltar_loja_ts")).not.toBeNull();
    // Intent ainda não foi sinalizado — só o BackToLojaButton sinaliza.
    expect(sessionStorage.getItem("voltar_loja_intent")).toBeNull();
  });
});

describe("LojaSheet → BackToLojaButton integração", () => {
  it("não mostra botão de voltar sem state fromLoja", () => {
    render(
      <MemoryRouter initialEntries={["/produtos"]}>
        <BackToLojaButton />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Voltar para/i)).not.toBeInTheDocument();
  });

  it("mostra botão 'Voltar para {loja}' quando state vier do LojaSheet", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/produtos",
            state: { fromLoja: true, lojaId: "loja-1", lojaName: "Loja Centro" },
          },
        ]}
      >
        <BackToLojaButton />
      </MemoryRouter>
    );
    expect(screen.getByText("Voltar para Loja Centro")).toBeInTheDocument();
  });
});
