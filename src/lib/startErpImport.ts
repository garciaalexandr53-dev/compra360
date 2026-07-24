/**
 * Pure helper for "Importar do ERP" entry point on the Dashboard.
 *
 * Contract:
 * - If there's already an active cotação, reuse it (no insert).
 * - Otherwise, require a loja ativa and create a new cotação for it.
 * - Never opens the modal without a valid cotacao_id.
 */

export interface StartErpImportDeps {
  cotacaoAtivaId: string | null | undefined;
  lojaAtivaId: string | null | undefined;
  insertCotacao: (payload: {
    loja_id: string;
    status: "ativa";
    nome: string;
  }) => Promise<{ id: string } | null>;
  now?: () => Date;
}

export type StartErpImportResult =
  | { ok: true; cotacaoId: string; created: boolean }
  | { ok: false; reason: "no-loja" | "insert-failed" };

export async function startErpImport(
  deps: StartErpImportDeps
): Promise<StartErpImportResult> {
  if (deps.cotacaoAtivaId) {
    return { ok: true, cotacaoId: deps.cotacaoAtivaId, created: false };
  }
  if (!deps.lojaAtivaId) {
    return { ok: false, reason: "no-loja" };
  }
  const now = (deps.now ?? (() => new Date()))();
  const created = await deps.insertCotacao({
    loja_id: deps.lojaAtivaId,
    status: "ativa",
    nome: `Cotação ${now.toLocaleDateString("pt-BR")}`,
  });
  if (!created?.id) return { ok: false, reason: "insert-failed" };
  return { ok: true, cotacaoId: created.id, created: true };
}
