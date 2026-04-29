import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ProdutoSheet, { type ProdutoSheetItem } from "./ProdutoSheet";

const produto: ProdutoSheetItem = {
  id: "p1",
  nome: "Arroz Tio João 5kg",
  embalagem: "FD",
  fator_embalagem: 6,
  categorias: { nome: "Mercearia" },
};

describe("ProdutoSheet", () => {
  it("renderiza nome, categoria, embalagem e fator quando aberto", () => {
    render(
      <ProdutoSheet
        produto={produto}
        open
        onOpenChange={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByText("Arroz Tio João 5kg")).toBeInTheDocument();
    expect(screen.getByText(/Mercearia · FD · Fator 6/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar produto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir produto/i })).toBeInTheDocument();
  });

  it("não renderiza quando produto é null", () => {
    const { container } = render(
      <ProdutoSheet
        produto={null}
        open
        onOpenChange={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("dispara onEdit ao clicar em Editar produto", () => {
    const onEdit = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ProdutoSheet
        produto={produto}
        open
        onOpenChange={onOpenChange}
        onEdit={onEdit}
        onDelete={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Editar produto/i }));
    expect(onEdit).toHaveBeenCalledWith(produto);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("abre AlertDialog de confirmação antes de excluir", () => {
    const onDelete = vi.fn();
    render(
      <ProdutoSheet
        produto={produto}
        open
        onOpenChange={() => {}}
        onEdit={() => {}}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Excluir produto/i }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Tem certeza que deseja excluir este produto/i)).toBeInTheDocument();
    // ainda não excluiu
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("não exclui ao cancelar a confirmação", () => {
    const onDelete = vi.fn();
    render(
      <ProdutoSheet
        produto={produto}
        open
        onOpenChange={() => {}}
        onEdit={() => {}}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Excluir produto/i }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancelar/i }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("dispara onDelete ao confirmar exclusão", () => {
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ProdutoSheet
        produto={produto}
        open
        onOpenChange={onOpenChange}
        onEdit={() => {}}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Excluir produto/i }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Excluir$/i }));

    expect(onDelete).toHaveBeenCalledWith(produto);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("usa fallback de categoria, embalagem e fator quando ausentes", () => {
    render(
      <ProdutoSheet
        produto={{ id: "x", nome: "Sem dados", embalagem: null, fator_embalagem: null, categorias: null }}
        open
        onOpenChange={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText(/Sem Categoria · un · Fator 1/i)).toBeInTheDocument();
  });
});
