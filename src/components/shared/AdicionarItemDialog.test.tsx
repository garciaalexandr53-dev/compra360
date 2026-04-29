import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdicionarItemDialog } from "./AdicionarItemDialog";
import { FATOR_PADRAO } from "@/lib/embalagemFatores";

// jsdom polyfills used by Radix Dialog
beforeEach(() => {
  cleanup();
  if (!(window as any).ResizeObserver) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // hasPointerCapture / scrollIntoView used by Radix
  if (!(Element.prototype as any).hasPointerCapture) {
    (Element.prototype as any).hasPointerCapture = () => false;
  }
  if (!(Element.prototype as any).scrollIntoView) {
    (Element.prototype as any).scrollIntoView = () => {};
  }
});

const produto = { nome: "Produto Teste", embalagem: "UNI", fator: 1 };

const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });
  window.dispatchEvent(new Event("resize"));
};

describe("AdicionarItemDialog — fator UI", () => {
  it("atualiza o fator ao trocar a embalagem (UNI → CX → DP → ½DZ → FD)", () => {
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );

    const fatorInput = screen.getByLabelText(/Fator/i) as HTMLInputElement;
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.UNI)); // 1

    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.CX)); // 12

    fireEvent.click(screen.getByRole("button", { name: "DP" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.DP)); // 12

    fireEvent.click(screen.getByRole("button", { name: "½DZ" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO["½DZ"])); // 6

    fireEvent.click(screen.getByRole("button", { name: "FD" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.FD)); // 6
  });

  it("recalcula o total exibido ao trocar a embalagem", () => {
    render(
      <AdicionarItemDialog
        produto={produto}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
        quantidadeInicial={2}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    // 2 CX = 24 unidades
    expect(screen.getByText(/24 unidades/i)).toBeInTheDocument();
    expect(screen.getByText(/2 CX/i)).toBeInTheDocument();
  });

  it("fallback no blur: fator vazio volta ao padrão da embalagem", () => {
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "DP" }));
    const fatorInput = screen.getByLabelText(/Fator/i) as HTMLInputElement;
    fireEvent.change(fatorInput, { target: { value: "" } });
    fireEvent.blur(fatorInput);
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.DP)); // 12
  });
});

describe("AdicionarItemDialog — responsivo", () => {
  it("renderiza corretamente em 360px (mobile)", () => {
    setViewport(360);
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );

    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByLabelText(/Embalagem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantidade do pedido/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/w-\[calc\(100vw-32px\)\]/);
    expect(dialog.className).toMatch(/max-w-md/);
  });

  it("renderiza corretamente em 1280px (desktop)", () => {
    setViewport(1280);
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );

    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    // Todas as 9 embalagens visíveis
    ["UNI", "CX", "DZ", "½DZ", "DP", "FD", "KG", "PCT", "LT"].forEach((emb) => {
      expect(screen.getByRole("button", { name: emb })).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-md/);
    // padding maior em sm+
    expect(dialog.className).toMatch(/sm:p-6/);
  });
});
