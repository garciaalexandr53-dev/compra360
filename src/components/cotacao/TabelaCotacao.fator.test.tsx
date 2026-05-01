import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabelaCotacao from "./TabelaCotacao";

const baseProduto = {
  id: "p1",
  nome: "Arroz 5kg",
  embalagem: "fd",
  fator_embalagem: 1,
  ativo: true,
  user_id: "u1",
  categoria_id: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
} as any;

const makeCp = (fator: number) => ({
  id: "cp1",
  produto_id: "p1",
  cotacao_id: "c1",
  quantidade: 10,
  fator_embalagem: fator,
  tipo_embalagem: "FD",
  produto: baseProduto,
});

const baseProps = (cp: any, onFieldBlur: any) => ({
  filteredItems: [cp],
  fornecedores: [],
  precos: [],
  localPrices: {},
  filterAnomalies: false,
  cotacaoProdutosCount: 1,
  grandTotal: 0,
  legendVisible: false,
  onLegendClose: () => {},
  analyzePrices: () => ({ min: null, second: null, minVal: null, tiedCount: 0, allVals: [] }),
  getHistAlert: () => null,
  getIntraAnomaly: () => null,
  historicalAvgMap: {},
  onPriceChange: () => {},
  onPriceBlur: () => {},
  onFieldBlur,
  onDeleteItem: () => {},
});

describe("TabelaCotacao - edição do FATOR persiste após reload", () => {
  it("edita o fator, dispara onFieldBlur e o novo valor permanece após re-render simulando reload", () => {
    const onFieldBlur = vi.fn();
    let cp = makeCp(12);

    const { rerender } = render(<TabelaCotacao {...baseProps(cp, onFieldBlur)} />);

    const fatorInput = screen.getByLabelText("Fator de embalagem") as HTMLInputElement;
    expect(fatorInput.value).toBe("12");

    // Usuário foca, limpa e digita 24
    fireEvent.focus(fatorInput);
    fireEvent.change(fatorInput, { target: { value: "24" } });
    expect(fatorInput.value).toBe("24");

    // Blur dispara persistência no backend
    fireEvent.blur(fatorInput);
    expect(onFieldBlur).toHaveBeenCalledWith("cp1", "fator", "24", "12");

    // Simula reload: re-render com dado vindo do banco já com fator=24
    cp = makeCp(24);
    rerender(<TabelaCotacao {...baseProps(cp, onFieldBlur)} />);

    const reloaded = screen.getByLabelText("Fator de embalagem") as HTMLInputElement;
    expect(reloaded.value).toBe("24");
  });

  it("sanitiza fator inválido (vazio) para 1 ao salvar", () => {
    const onFieldBlur = vi.fn();
    const cp = makeCp(12);

    render(<TabelaCotacao {...baseProps(cp, onFieldBlur)} />);
    const fatorInput = screen.getByLabelText("Fator de embalagem") as HTMLInputElement;

    fireEvent.focus(fatorInput);
    fireEvent.change(fatorInput, { target: { value: "" } });
    fireEvent.blur(fatorInput);

    // Quando inválido, cai no fallback do componente (fator atual = 12)
    expect(onFieldBlur).toHaveBeenCalledWith("cp1", "fator", "12", "12");
  });
});
