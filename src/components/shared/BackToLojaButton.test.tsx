import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BackToLojaButton from "./BackToLojaButton";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return { ...actual, useNavigate: () => navigateMock };
});

const renderWithState = (state: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/destino", state }]}>
      <BackToLojaButton />
    </MemoryRouter>
  );

describe("BackToLojaButton", () => {
  it("não renderiza sem location.state", () => {
    render(
      <MemoryRouter initialEntries={["/destino"]}>
        <BackToLojaButton />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Voltar para/i)).not.toBeInTheDocument();
  });

  it("não renderiza quando fromLoja é false", () => {
    renderWithState({ fromLoja: false, lojaName: "Loja X" });
    expect(screen.queryByText(/Voltar para/i)).not.toBeInTheDocument();
  });

  it("renderiza 'Voltar para {lojaName}' quando vier do LojaSheet", () => {
    renderWithState({ fromLoja: true, lojaId: "abc", lojaName: "Loja Centro" });
    expect(screen.getByText("Voltar para Loja Centro")).toBeInTheDocument();
  });

  it("usa fallback 'Lojas' se lojaName ausente", () => {
    renderWithState({ fromLoja: true });
    expect(screen.getByText("Voltar para Lojas")).toBeInTheDocument();
  });

  it("ao clicar, chama navigate(-1)", () => {
    navigateMock.mockClear();
    renderWithState({ fromLoja: true, lojaName: "Loja A" });
    fireEvent.click(screen.getByText("Voltar para Loja A"));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
