import { describe, it, expect } from "vitest";

/**
 * Pure unit test of the partition logic used in CotacaoPage.saveSupplierSelection.
 * Mirrors the rules:
 *  - upsert (ignoreDuplicates) for newly selected ids that are not in `existing`
 *  - delete only for unselected ids whose status_envio is null/pendente
 *  - keep (protect) unselected ids whose status_envio is enviado/entregue/falhou
 */
type ExistingRow = { fornecedor_id: string; status_envio?: string | null };

function partition(existing: ExistingRow[], selected: string[]) {
  const selectedSet = new Set(selected);
  const existingIds = new Set(existing.map((e) => e.fornecedor_id));
  const removed = existing.filter((e) => !selectedSet.has(e.fornecedor_id));
  const removable = removed
    .filter((e) => !e.status_envio || e.status_envio === "pendente")
    .map((e) => e.fornecedor_id);
  const protectedIds = removed
    .filter((e) => e.status_envio && e.status_envio !== "pendente")
    .map((e) => e.fornecedor_id);
  const toInsert = selected.filter((id) => !existingIds.has(id));
  return { removable, protectedIds, toInsert };
}

describe("saveSupplierSelection partition", () => {
  it("inserts only newly selected suppliers and does not touch existing", () => {
    const r = partition(
      [{ fornecedor_id: "a", status_envio: "pendente" }],
      ["a", "b"],
    );
    expect(r.toInsert).toEqual(["b"]);
    expect(r.removable).toEqual([]);
    expect(r.protectedIds).toEqual([]);
  });

  it("removes unselected suppliers when status is pendente", () => {
    const r = partition(
      [
        { fornecedor_id: "a", status_envio: "pendente" },
        { fornecedor_id: "b", status_envio: null },
      ],
      [],
    );
    expect(r.removable.sort()).toEqual(["a", "b"]);
    expect(r.protectedIds).toEqual([]);
  });

  it("protects unselected suppliers that already received a pedido (enviado/entregue/falhou)", () => {
    const r = partition(
      [
        { fornecedor_id: "a", status_envio: "enviado" },
        { fornecedor_id: "b", status_envio: "entregue" },
        { fornecedor_id: "c", status_envio: "falhou" },
        { fornecedor_id: "d", status_envio: "pendente" },
      ],
      [],
    );
    expect(r.removable).toEqual(["d"]);
    expect(r.protectedIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("idempotent re-save: no inserts, no deletes when selection matches existing", () => {
    const r = partition(
      [
        { fornecedor_id: "a", status_envio: "enviado" },
        { fornecedor_id: "b", status_envio: "pendente" },
      ],
      ["a", "b"],
    );
    expect(r.toInsert).toEqual([]);
    expect(r.removable).toEqual([]);
    expect(r.protectedIds).toEqual([]);
  });
});
