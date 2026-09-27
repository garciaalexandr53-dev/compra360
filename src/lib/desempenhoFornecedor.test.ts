import { describe, it, expect } from "vitest";
import { classificarDesempenho } from "./desempenhoFornecedor";

describe("classificarDesempenho", () => {
  it("novo sem cotações", () => {
    expect(classificarDesempenho(0, 0, null).tom).toBe("novo");
  });
  it("1-2 cotações", () => {
    expect(classificarDesempenho(2, 1, 3).texto).toBe("Participou de 2 cotações na região");
  });
  it("faixas", () => {
    expect(classificarDesempenho(10, 9, 30).tom).toBe("positivo");
    expect(classificarDesempenho(10, 6, 30).tom).toBe("atencao");
    expect(classificarDesempenho(10, 3, 30).tom).toBe("neutro");
    expect(classificarDesempenho(10, 9, 30).texto).toBe("90% de resposta · 10 cotações na região");
  });
  it("ágil abaixo de 12h", () => {
    expect(classificarDesempenho(5, 5, 4).agil).toBe(true);
    expect(classificarDesempenho(5, 5, 20).agil).toBe(false);
  });
});
