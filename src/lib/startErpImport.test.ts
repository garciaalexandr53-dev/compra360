import { describe, it, expect, vi } from "vitest";
import { startErpImport } from "./startErpImport";

describe("startErpImport — fluxo Dashboard 'Importar do ERP'", () => {
  it("reutiliza cotação ativa existente sem criar nova", async () => {
    const insertCotacao = vi.fn();
    const res = await startErpImport({
      cotacaoAtivaId: "cot-existente",
      lojaAtivaId: "loja-1",
      insertCotacao,
    });
    expect(res).toEqual({ ok: true, cotacaoId: "cot-existente", created: false });
    expect(insertCotacao).not.toHaveBeenCalled();
  });

  it("cria cotação nova automaticamente com a loja ativa quando não há ativa", async () => {
    const insertCotacao = vi.fn().mockResolvedValue({ id: "cot-nova" });
    const res = await startErpImport({
      cotacaoAtivaId: null,
      lojaAtivaId: "loja-42",
      insertCotacao,
      now: () => new Date("2026-07-24T12:00:00Z"),
    });
    expect(res).toEqual({ ok: true, cotacaoId: "cot-nova", created: true });
    expect(insertCotacao).toHaveBeenCalledTimes(1);
    const payload = insertCotacao.mock.calls[0][0];
    expect(payload.loja_id).toBe("loja-42");
    expect(payload.status).toBe("ativa");
    expect(payload.nome).toMatch(/^Cotação \d{2}\/\d{2}\/\d{4}$/);
  });

  it("bloqueia quando não há loja ativa (não abre modal, não insere)", async () => {
    const insertCotacao = vi.fn();
    const res = await startErpImport({
      cotacaoAtivaId: null,
      lojaAtivaId: null,
      insertCotacao,
    });
    expect(res).toEqual({ ok: false, reason: "no-loja" });
    expect(insertCotacao).not.toHaveBeenCalled();
  });

  it("propaga falha de insert como insert-failed (não abre modal)", async () => {
    const insertCotacao = vi.fn().mockResolvedValue(null);
    const res = await startErpImport({
      cotacaoAtivaId: undefined,
      lojaAtivaId: "loja-1",
      insertCotacao,
    });
    expect(res).toEqual({ ok: false, reason: "insert-failed" });
  });

  it("nunca retorna ok sem cotacaoId (garantia do contrato)", async () => {
    const insertCotacao = vi.fn().mockResolvedValue({ id: "" });
    const res = await startErpImport({
      cotacaoAtivaId: null,
      lojaAtivaId: "loja-1",
      insertCotacao,
    });
    expect(res.ok).toBe(false);
  });
});
