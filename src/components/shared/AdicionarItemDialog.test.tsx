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

    const [fatorInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
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
    const [fatorInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(fatorInput, { target: { value: "" } });
    fireEvent.blur(fatorInput);
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.DP)); // 12
  });
});

describe("AdicionarItemDialog — seletores robustos e recálculo", () => {
  it("localiza fator e quantidade por role=spinbutton (sem depender de label)", () => {
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    const [fatorInput, qtdInput] = inputs;
    expect(fatorInput.value).toBe("1");
    expect(qtdInput.value).toBe("1");
  });

  it("recalcula o total ao alterar a quantidade usando o fator padrão da embalagem", () => {
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    const [, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(qtdInput, { target: { value: "5" } });
    // 5 CX × 12 = 60 unidades
    expect(screen.getByText(/5 CX/i)).toBeInTheDocument();
    expect(screen.getByText(/60 unidades/i)).toBeInTheDocument();

    fireEvent.change(qtdInput, { target: { value: "3" } });
    // 3 CX × 12 = 36 unidades
    expect(screen.getByText(/3 CX/i)).toBeInTheDocument();
    expect(screen.getByText(/36 unidades/i)).toBeInTheDocument();
  });
});

describe("AdicionarItemDialog — fechamento descarta estado", () => {
  it("ao cancelar e reabrir, fator/quantidade voltam aos valores iniciais do produto", () => {
    const onCancelar = vi.fn();
    const { rerender } = render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={onCancelar} />,
    );

    // Altera embalagem (fator vira 12) e quantidade
    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    const [fatorInput, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(qtdInput, { target: { value: "9" } });
    expect(fatorInput.value).toBe("12");
    expect(qtdInput.value).toBe("9");

    // Fecha o diálogo
    rerender(
      <AdicionarItemDialog produto={null} onConfirmar={vi.fn()} onCancelar={onCancelar} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reabre com o mesmo produto — estado deve ter sido descartado
    rerender(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={onCancelar} />,
    );
    const [fatorReaberto, qtdReaberto] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(fatorReaberto.value).toBe(String(FATOR_PADRAO.UNI)); // 1
    expect(qtdReaberto.value).toBe("1");
  });
});

describe("AdicionarItemDialog — responsivo", () => {
  it("renderiza corretamente em 360px (mobile)", () => {
    setViewport(360);
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );

    expect(screen.getByText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Embalagem")).toBeInTheDocument();
    expect(screen.getByText(/Fator/i)).toBeInTheDocument();
    expect(screen.getByText("Quantidade do pedido")).toBeInTheDocument();
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

describe("AdicionarItemDialog — validação", () => {
  it("desabilita o botão Adicionar quando a quantidade está vazia ou zero", () => {
    const onConfirmar = vi.fn();
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={onConfirmar} onCancelar={vi.fn()} />,
    );

    const [, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const btnAdicionar = screen.getByRole("button", { name: /Adicionar/i }) as HTMLButtonElement;

    // Quantidade = 0 → desabilitado e mensagem orientativa
    fireEvent.change(qtdInput, { target: { value: "0" } });
    expect(btnAdicionar).toBeDisabled();
    expect(screen.getByText(/Informe a quantidade/i)).toBeInTheDocument();

    // Quantidade vazia → desabilitado
    fireEvent.change(qtdInput, { target: { value: "" } });
    expect(btnAdicionar).toBeDisabled();
    expect(screen.getByText(/Informe a quantidade/i)).toBeInTheDocument();

    // Click no botão desabilitado não chama onConfirmar
    fireEvent.click(btnAdicionar);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("habilita o botão Adicionar somente quando a quantidade é válida (>=1)", () => {
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );
    const [, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const btnAdicionar = screen.getByRole("button", { name: /Adicionar/i }) as HTMLButtonElement;

    fireEvent.change(qtdInput, { target: { value: "1" } });
    expect(btnAdicionar).not.toBeDisabled();
  });

  it("ao confirmar com fator inválido (vazio), usa o fator padrão da embalagem", () => {
    const onConfirmar = vi.fn();
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={onConfirmar} onCancelar={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    const [fatorInput, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    // Esvazia o fator e confirma — deve cair para FATOR_PADRAO.CX = 12
    fireEvent.change(fatorInput, { target: { value: "" } });
    fireEvent.change(qtdInput, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).toHaveBeenCalledWith(2, "CX", FATOR_PADRAO.CX);
  });
});

describe("AdicionarItemDialog — troca rápida de embalagem", () => {
  it("alterna UNI ↔ CX rapidamente sem deixar valores obsoletos no fator/total", () => {
    render(
      <AdicionarItemDialog
        produto={produto}
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
        quantidadeInicial={3}
      />,
    );

    const [fatorInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    // Sequência rápida UNI → CX → UNI → CX → UNI
    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.CX));
    expect(screen.getByText(/3 CX/i)).toBeInTheDocument();
    expect(screen.getByText(/36 unidades/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "UNI" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.UNI));
    expect(screen.getByText(/3 UNI/i)).toBeInTheDocument();
    // fator 1 não exibe "= N unidades"
    expect(screen.queryByText(/unidades/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    expect(fatorInput.value).toBe(String(FATOR_PADRAO.CX));
    expect(screen.getByText(/36 unidades/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "UNI" }));
    expect(fatorInput.value).toBe("1");
    expect(screen.queryByText(/unidades/i)).not.toBeInTheDocument();
  });
});

describe("AdicionarItemDialog — comportamento de Enter", () => {
  it("Enter na quantidade confirma quando estado é válido", () => {
    const onConfirmar = vi.fn();
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={onConfirmar} onCancelar={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "CX" }));
    const [, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(qtdInput, { target: { value: "4" } });
    fireEvent.keyDown(qtdInput, { key: "Enter" });

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).toHaveBeenCalledWith(4, "CX", FATOR_PADRAO.CX);
  });

  it("Enter na quantidade NÃO confirma quando quantidade é 0/vazia", () => {
    const onConfirmar = vi.fn();
    render(
      <AdicionarItemDialog produto={produto} onConfirmar={onConfirmar} onCancelar={vi.fn()} />,
    );

    const [, qtdInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(qtdInput, { target: { value: "0" } });
    fireEvent.keyDown(qtdInput, { key: "Enter" });
    expect(onConfirmar).not.toHaveBeenCalled();

    fireEvent.change(qtdInput, { target: { value: "" } });
    fireEvent.keyDown(qtdInput, { key: "Enter" });
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
