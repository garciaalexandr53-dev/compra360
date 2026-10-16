import { describe, it, expect } from "vitest";
import { podeFecharComQuemRespondeu } from "./fecharComQuemRespondeu";

const NOW = new Date("2026-10-15T18:00:00Z").getTime();
const PASSADO = "2026-10-15T15:00:00Z";
const FUTURO = "2026-10-15T21:00:00Z";

describe("podeFecharComQuemRespondeu", () => {
  it("exibe quando prazo expirou, há respostas e há pendentes", () => {
    expect(podeFecharComQuemRespondeu(PASSADO, 3, 2, NOW)).toBe(true);
  });
  it("não exibe antes do prazo vencer", () => {
    expect(podeFecharComQuemRespondeu(FUTURO, 3, 2, NOW)).toBe(false);
  });
  it("não exibe sem prazo definido", () => {
    expect(podeFecharComQuemRespondeu(null, 3, 2, NOW)).toBe(false);
    expect(podeFecharComQuemRespondeu(undefined, 3, 2, NOW)).toBe(false);
  });
  it("não exibe quando ninguém respondeu", () => {
    expect(podeFecharComQuemRespondeu(PASSADO, 0, 2, NOW)).toBe(false);
  });
  it("não exibe quando não há pendentes", () => {
    expect(podeFecharComQuemRespondeu(PASSADO, 3, 0, NOW)).toBe(false);
  });
});
