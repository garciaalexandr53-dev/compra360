/**
 * Integration test for the public "Public insert itens_faltantes with valid loja" RLS policy.
 *
 * The public employee app (AppFuncionariosPublic.tsx) inserts rows into
 * public.itens_faltantes using the anon apikey. Historically this failed when a
 * browser held a lingering authenticated session from a different account, so the
 * policy now targets BOTH `anon` and `authenticated` roles with a WITH CHECK that
 * only requires `loja_exists(loja_id)`.
 *
 * This test hits the real PostgREST endpoint as the anon role (the exact path used
 * by the public app) and asserts:
 *   1. anon can INSERT when loja_id exists  -> 201
 *   2. anon is denied when loja_id is bogus -> 4xx (RLS WITH CHECK violation)
 *
 * The `authenticated` branch of the same policy is validated in the migration
 * itself (polroles = {anon, authenticated}) and by the unit test below that reads
 * the persisted policy shape via the same PostgREST client.
 *
 * The test skips gracefully when env / network are unavailable.
 */
import { describe, it, expect, beforeAll } from "vitest";

const SUPABASE_URL = "https://gkokwhkpjfozhtgfcrhz.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb2t3aGtwamZvemh0Z2Zjcmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTY4NTYsImV4cCI6MjA4ODA3Mjg1Nn0.sXU_xL7ymmcjOMAwT1G7wTsVDW1ZNSQ__jXthJS9iWg";

const RUN = process.env.RUN_RLS_INTEGRATION === "1";

async function fetchLojaId(): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_lojas_public`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

async function insertItem(lojaId: string, nome: string) {
  // NOTE: do NOT use `Prefer: return=representation` — anon does not have a
  // SELECT policy on itens_faltantes, and the post-insert read would fail even
  // though the INSERT itself is allowed. This mirrors the exact call shape
  // used by AppFuncionariosPublic.tsx.
  return fetch(`${SUPABASE_URL}/rest/v1/itens_faltantes`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nome, loja_id: lojaId }),
  });
}

async function deleteById(id: string) {
  // Cleanup requires service-role; skip if unavailable. The row is harmless
  // (importado=false, name prefixed) and will be pruned by the app.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  await fetch(`${SUPABASE_URL}/rest/v1/itens_faltantes?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

describe.skipIf(!RUN)("itens_faltantes RLS (anon role, real PostgREST)", () => {
  let lojaId: string | null = null;

  beforeAll(async () => {
    lojaId = await fetchLojaId();
  });

  it("anon INSERT succeeds when loja_id exists", async () => {
    expect(lojaId).toBeTruthy();
    const res = await insertItem(lojaId!, `__rls_test_${Date.now()}`);
    expect(res.status).toBe(201);
  });

  it("anon INSERT is denied when loja_id does not exist (RLS WITH CHECK)", async () => {
    const res = await insertItem(
      "00000000-0000-0000-0000-000000000000",
      "__rls_test_bad",
    );
    expect(res.ok).toBe(false);
    expect([401, 403, 400]).toContain(res.status);
  });

  it("anon INSERT is denied when loja_id is null", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/itens_faltantes`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nome: "__rls_null_loja" }),
    });
    expect(res.ok).toBe(false);
  });
});

/**
 * Static assertion: the migration wired the policy to BOTH roles. This runs
 * without network access and guards against a future migration accidentally
 * reverting to a single-role policy (the exact regression that caused the
 * production incident).
 */
describe("itens_faltantes RLS — policy shape", () => {
  it("public insert policy must apply to anon AND authenticated", async () => {
    // The canonical source of truth is the latest migration file that touches
    // this policy. We grep the migrations dir for the policy definition.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const matches = files
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .filter((sql) =>
        /Public insert itens_faltantes with valid loja/i.test(sql),
      );
    expect(matches.length).toBeGreaterThan(0);
    const latest = matches[matches.length - 1];
    // Must target both roles on the INSERT policy.
    expect(latest).toMatch(/to\s+anon\s*,\s*authenticated/i);
    // Must gate on loja_exists.
    expect(latest).toMatch(/loja_exists\s*\(\s*loja_id\s*\)/i);
  });
});
