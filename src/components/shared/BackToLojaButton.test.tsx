import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import BackToLojaButton from "./BackToLojaButton";

function NavigatorWithState({ state }: { state: unknown }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/destino", { state })}>go</button>
  );
}

function CurrentPath() {
  const loc = useLocation();
  return <div data-testid="path">{loc.pathname}</div>;
}

const renderAt = (state: unknown) => {
  return render(
    <MemoryRouter initialEntries={["/origem"]}>
      <Routes>
        <Route
          path="/origem"
          element={<NavigatorWithState state={state} />}
        />
        <Route
          path="/destino"
          element={
            <>
              <BackToLojaButton />
              <CurrentPath />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("BackToLojaButton", () => {
  it("não renderiza quando location.state.fromLoja não existe", () => {
    render(
      <MemoryRouter initialEntries={["/destino"]}>
        <BackToLojaButton />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Voltar para/i)).not.toBeInTheDocument();
  });

  it("não renderiza quando fromLoja é false", () => {
    renderAt({ fromLoja: false, lojaName: "Loja X" });
    expect(screen.queryByText(/Voltar para/i)).not.toBeInTheDocument();
  });

  it("renderiza 'Voltar para {lojaName}' quando vier do LojaSheet", () => {
    renderAt({ fromLoja: true, lojaId: "abc", lojaName: "Loja Centro" });
    expect(screen.getByText("Voltar para Loja Centro")).toBeInTheDocument();
  });

  it("usa fallback 'Lojas' se lojaName ausente", () => {
    renderAt({ fromLoja: true });
    expect(screen.getByText("Voltar para Lojas")).toBeInTheDocument();
  });

  it("ao clicar, volta para a página anterior", () => {
    renderAt({ fromLoja: true, lojaName: "Loja A" });
    expect(screen.getByTestId("path").textContent).toBe("/destino");
    fireEvent.click(screen.getByText("Voltar para Loja A"));
    expect(screen.getByText("go")).toBeInTheDocument();
  });
});
