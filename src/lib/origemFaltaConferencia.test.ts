import { describe, it, expect } from "vitest";
import { montarOrigemFaltaConferencia, origemFaltaConferencia } from "@/lib/itensFaltantesImport";

describe("origemFaltaConferencia", () => {
  it("ida e volta", () => {
    const s = montarOrigemFaltaConferencia(12, "Atacadão", "Maria");
    expect(origemFaltaConferencia(s)).toEqual({ pedido: "12", fornecedor: "Atacadão" });
  });
  it("ignora itens da equipe e formato antigo", () => {
    expect(origemFaltaConferencia("Funcionário · Loja 1")).toBeNull();
    expect(origemFaltaConferencia("Conferência - Maria")).toBeNull();
    expect(origemFaltaConferencia(null)).toBeNull();
  });
});
