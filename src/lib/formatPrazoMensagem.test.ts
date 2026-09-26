import { describe, it, expect } from "vitest";
import { formatPrazoMensagem } from "./format";

const now = new Date(2026, 8, 25, 10, 0).getTime();
describe("formatPrazoMensagem", () => {
  it("hoje", () => expect(formatPrazoMensagem(new Date(2026, 8, 25, 18, 0).toISOString(), now)).toBe("⏰ *Fechamento da cotação: hoje até às 18:00*"));
  it("amanhã", () => expect(formatPrazoMensagem(new Date(2026, 8, 26, 9, 30).toISOString(), now)).toContain("amanhã até às 09:30*"));
  it("outra data", () => expect(formatPrazoMensagem(new Date(2026, 8, 28, 12, 0).toISOString(), now)).toContain("dia 28/09 até às 12:00*"));
  it("nulo", () => expect(formatPrazoMensagem(null, now)).toBe(""));
  it("vencido", () => expect(formatPrazoMensagem(new Date(2026, 8, 25, 9, 0).toISOString(), now)).toBe(""));
});
