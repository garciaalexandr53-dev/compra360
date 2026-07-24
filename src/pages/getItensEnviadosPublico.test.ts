/**
 * Tests for the public RPC `get_itens_enviados_publico`.
 *
 * The public employee app (AppFuncionariosPublic.tsx) reads sent items via this
 * SECURITY DEFINER function because anon has no SELECT policy on itens_faltantes.
 *
 * Asserts:
 *  1. Migration shape: SECURITY DEFINER + EXECUTE granted to anon/authenticated
 *     + scoped to a specific loja_id (never a global read).
 *  2. Integration (RUN_RLS_INTEGRATION=1): anon can call the RPC for a valid
 *     loja and receives rows; direct table SELECT stays blocked; unknown loja
 *     returns an empty array (no leak).
 */
import { describe, it, expect, beforeAll } from "vitest";

const SUPABASE_URL = "https://gkokwhkpjfozhtgfcrhz.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb2t3aGtwamZvemh0Z2Zjcmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0OTY4NTYsImV4cCI6MjA4ODA3Mjg1Nn0.sXU_xL7ymmcjOMAwT1G7wTsVDW1ZNSQ__jXthJS9iWg";

const RUN = process.env.RUN_RLS_INTEGRATION === "1";

async function rpc(fn: string, body: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("get_itens_enviados_publico — migration shape", () => {
  it("is SECURITY DEFINER, granted to anon/authenticated, scoped by loja_id", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const sources = files
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .filter((sql) => /get_itens_enviados_publico/i.test(sql));
    expect(sources.length).toBeGreaterThan(0);
    const latest = sources[sources.length - 1];

    // Must be a SECURITY DEFINER function.
    expect(latest).toMatch(/security\s+definer/i);
    // Must lock search_path to public to prevent hijacking.
    expect(latest).toMatch(/set\s+search_path\s*(=|to)\s*['"]?public['"]?/i);
    // Must accept a loja_id argument (never a global scan).
    expect(latest).toMatch(/_loja_id\s+uuid/i);
    // Body must filter by that argument.
    expect(latest).toMatch(/loja_id\s*=\s*_loja_id/i);
    // EXECUTE must be granted to anon and authenticated.
    expect(latest).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.get_itens_enviados_publico[^;]*to\s+[^;]*\banon\b/i,
    );
    expect(latest).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.get_itens_enviados_publico[^;]*to\s+[^;]*\bauthenticated\b/i,
    );
  });
});

describe.skipIf(!RUN)(
  "get_itens_enviados_publico — anon role, real PostgREST",
  () => {
    let lojaId: string | null = null;

    beforeAll(async () => {
      const res = await rpc("get_lojas_public", {});
      if (res.ok) {
        const rows = (await res.json()) as Array<{ id: string }>;
        lojaId = rows[0]?.id ?? null;
      }
    });

    it("anon can call the RPC for a valid loja and get an array back", async () => {
      expect(lojaId).toBeTruthy();
      const since = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const res = await rpc("get_itens_enviados_publico", {
        _loja_id: lojaId,
        _since: since,
      });
      expect(res.status).toBe(200);
      const rows = await res.json();
      expect(Array.isArray(rows)).toBe(true);
    });

    it("returns empty array for a non-existent loja (no leak)", async () => {
      const since = new Date(0).toISOString();
      const res = await rpc("get_itens_enviados_publico", {
        _loja_id: "00000000-0000-0000-0000-000000000000",
        _since: since,
      });
      expect(res.status).toBe(200);
      const rows = await res.json();
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(0);
    });

    it("direct SELECT on itens_faltantes remains blocked for anon", async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/itens_faltantes?select=id&limit=1`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
        },
      );
      // With no SELECT policy for anon, PostgREST returns 200 with [] OR 401/403.
      // The key invariant: no rows are exposed.
      if (res.ok) {
        const rows = await res.json();
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBe(0);
      } else {
        expect([401, 403]).toContain(res.status);
      }
    });
  },
);
