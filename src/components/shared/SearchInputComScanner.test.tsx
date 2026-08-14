import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchInputComScanner from "./SearchInputComScanner";

describe("SearchInputComScanner", () => {
  it("renderiza placeholder e botão de scanner", () => {
    render(<SearchInputComScanner value="" onChange={() => {}} placeholder="Buscar" />);
    expect(screen.getByPlaceholderText("Buscar")).toBeTruthy();
    expect(screen.getByLabelText("Escanear código de barras")).toBeTruthy();
  });

  it("mostra texto de ajuda só com campo vazio", () => {
    const { rerender } = render(
      <SearchInputComScanner value="" onChange={() => {}} textoAjuda="ajuda aqui" />,
    );
    expect(screen.queryByText("ajuda aqui")).toBeTruthy();
    rerender(<SearchInputComScanner value="arroz" onChange={() => {}} textoAjuda="ajuda aqui" />);
    expect(screen.queryByText("ajuda aqui")).toBeNull();
  });

  it("dispara onChange ao digitar", () => {
    const onChange = vi.fn();
    render(<SearchInputComScanner value="" onChange={onChange} placeholder="Buscar" />);
    fireEvent.change(screen.getByPlaceholderText("Buscar"), { target: { value: "leite" } });
    expect(onChange).toHaveBeenCalledWith("leite");
  });

  it("limpa o valor pelo botão X", () => {
    const onChange = vi.fn();
    render(<SearchInputComScanner value="leite" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Limpar busca"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("seleciona todo o texto ao focar (nova busca substitui o termo)", () => {
    render(<SearchInputComScanner value="detergente" onChange={() => {}} placeholder="Buscar" />);
    const input = screen.getByPlaceholderText("Buscar") as HTMLInputElement;
    const select = vi.spyOn(input, "select");
    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
  });

  it("não exibe o botão limpar com campo vazio", () => {
    render(<SearchInputComScanner value="" onChange={() => {}} />);
    expect(screen.queryByLabelText("Limpar busca")).toBeNull();
  });

  it("abre o modal do scanner ao clicar no ícone", () => {
    render(<SearchInputComScanner value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Escanear código de barras"));
    expect(screen.getByText("Escanear código de barras")).toBeTruthy();
    expect(screen.getByLabelText("Fechar scanner")).toBeTruthy();
  });
});
