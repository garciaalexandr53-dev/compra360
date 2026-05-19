import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Unit tests for the stripe-webhook edge function.
 *
 * These tests focus on:
 *  1. Signature verification (invalid signature → 400, missing env → 500).
 *  2. Per-event-type behavior: which fields are updated on the
 *     `subscriptions` table for each Stripe event.
 *
 * To keep tests hermetic and avoid hitting Stripe/Supabase, we stub the
 * `npm:stripe` and `npm:@supabase/supabase-js@2.57.2` modules via an import
 * map injected at import time. The stubs record calls so we can assert on
 * them.
 */

// ---- Shared in-memory recorder used by the stubs ----
type SubUpdate = { id: string; patch: Record<string, unknown> };
const recorder = {
  updates: [] as SubUpdate[],
  customerUpdates: [] as { customerId: string; patch: Record<string, unknown> }[],
  planLookups: [] as string[],
  reset() {
    this.updates.length = 0;
    this.customerUpdates.length = 0;
    this.planLookups.length = 0;
  },
};

// Expose the recorder on globalThis so the stubs (loaded via data: URLs)
// can mutate the same object the tests inspect.
// deno-lint-ignore no-explicit-any
(globalThis as any).__recorder = recorder;

// ---- Build stub modules as data: URLs and inject via import map ----
const stripeStub = `
const recorder = globalThis.__recorder;
export default class Stripe {
  constructor(_k, _o) {}
  webhooks = {
    constructEventAsync: async (body, sig) => {
      if (!sig || sig === "bad") {
        const err = new Error("No signatures found matching the expected signature");
        throw err;
      }
      return JSON.parse(body);
    },
  };
  subscriptions = {
    retrieve: async (id) => ({
      id,
      customer: "cus_test",
      status: "active",
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      canceled_at: null,
      items: { data: [{ price: { product: "prod_UJS4YQNTiMkNEO" } }] },
    }),
  };
}
`;

const supabaseStub = `
const recorder = globalThis.__recorder;
export function createClient() {
  const api = {
    from(table) {
      const state = { table, filter: null };
      const chain = {
        select: () => chain,
        eq: (col, val) => { state.filter = { col, val }; return chain; },
        single: async () => {
          if (state.table === "plans") {
            recorder.planLookups.push(state.filter?.val);
            return { data: { id: "plan-" + state.filter?.val }, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => {
          if (state.table === "subscriptions") {
            return { data: { id: "sub-row-1", user_id: "user-1" }, error: null };
          }
          return { data: null, error: null };
        },
        update: (patch) => ({
          eq: async (col, val) => {
            if (state.table === "subscriptions" && col === "id") {
              recorder.updates.push({ id: val, patch });
            } else if (state.table === "subscriptions" && col === "stripe_customer_id") {
              recorder.customerUpdates.push({ customerId: val, patch });
            }
            return { data: null, error: null };
          },
        }),
      };
      return chain;
    },
  };
  return api;
}
`;

const importMap = {
  imports: {
    "https://esm.sh/stripe@18.5.0": "data:application/javascript;base64," +
      btoa(stripeStub),
    "npm:@supabase/supabase-js@2.57.2": "data:application/javascript;base64," +
      btoa(supabaseStub),
  },
};

// Write the source of the edge function with imports rewritten to our stubs,
// then load it as a module. This avoids needing a Deno import map at the CLI.
const fnSource = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);
const patchedSource = fnSource
  .replace(
    `import Stripe from "https://esm.sh/stripe@18.5.0";`,
    `import Stripe from "${importMap.imports["https://esm.sh/stripe@18.5.0"]}";`,
  )
  .replace(
    `import { createClient } from "npm:@supabase/supabase-js@2.57.2";`,
    `import { createClient } from "${importMap.imports["npm:@supabase/supabase-js@2.57.2"]}";`,
  )
  // The function calls `serve(handler)` at module load. Replace it with an
  // export so tests can call the handler directly without binding a port.
  .replace(
    `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";`,
    `const serve = (h) => { globalThis.__handler = h; };`,
  );

Deno.env.set("STRIPE_SECRET_KEY", "sk_test_dummy");
Deno.env.set("STRIPE_WEBHOOK_SECRET", "whsec_dummy");
Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");

const moduleUrl = "data:application/typescript;base64," +
  btoa(unescape(encodeURIComponent(patchedSource)));
await import(moduleUrl);
// deno-lint-ignore no-explicit-any
const handler = (globalThis as any).__handler as (r: Request) => Promise<Response>;

function makeReq(event: unknown, opts: { signature?: string | null } = {}) {
  const body = typeof event === "string" ? event : JSON.stringify(event);
  const headers = new Headers();
  if (opts.signature !== null) {
    headers.set("stripe-signature", opts.signature ?? "valid_sig");
  }
  return new Request("http://x/stripe-webhook", {
    method: "POST",
    headers,
    body,
  });
}

// ---------------- Signature verification ----------------

Deno.test("rejects request with invalid signature (400)", async () => {
  recorder.reset();
  const res = await handler(makeReq({ type: "noop" }, { signature: "bad" }));
  const text = await res.text();
  assertEquals(res.status, 400);
  assertStringIncludes(text, "Webhook Error");
  assertEquals(recorder.updates.length, 0);
});

Deno.test("rejects request when missing stripe-signature header (400)", async () => {
  recorder.reset();
  const res = await handler(makeReq({ type: "noop" }, { signature: null }));
  await res.text();
  assertEquals(res.status, 400);
});

Deno.test("returns 500 when STRIPE_SECRET_KEY missing", async () => {
  recorder.reset();
  const prev = Deno.env.get("STRIPE_SECRET_KEY")!;
  Deno.env.delete("STRIPE_SECRET_KEY");
  const res = await handler(makeReq({ type: "noop" }));
  await res.text();
  assertEquals(res.status, 500);
  Deno.env.set("STRIPE_SECRET_KEY", prev);
});

Deno.test("returns 500 when STRIPE_WEBHOOK_SECRET missing", async () => {
  recorder.reset();
  const prev = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  Deno.env.delete("STRIPE_WEBHOOK_SECRET");
  const res = await handler(makeReq({ type: "noop" }));
  await res.text();
  assertEquals(res.status, 500);
  Deno.env.set("STRIPE_WEBHOOK_SECRET", prev);
});

// ---------------- Event handling ----------------

const subscriptionObject = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_123",
  customer: "cus_test",
  status: "active",
  current_period_start: 1700000000,
  current_period_end: 1702592000,
  canceled_at: null,
  items: { data: [{ price: { product: "prod_UJS4YQNTiMkNEO" } }] },
  ...overrides,
});

Deno.test("customer.subscription.created → updates subscription row with pro plan", async () => {
  recorder.reset();
  const res = await handler(makeReq({
    type: "customer.subscription.created",
    data: { object: subscriptionObject() },
  }));
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(recorder.updates.length, 1);
  const { id, patch } = recorder.updates[0];
  assertEquals(id, "sub-row-1");
  assertEquals(patch.status, "active");
  assertEquals(patch.stripe_subscription_id, "sub_123");
  assertEquals(patch.plan_id, "plan-pro");
  assertEquals(
    patch.current_period_end,
    new Date(1702592000 * 1000).toISOString(),
  );
  assertEquals(recorder.planLookups, ["pro"]);
});

Deno.test("customer.subscription.updated → maps business product to business plan", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "customer.subscription.updated",
    data: {
      object: subscriptionObject({
        items: { data: [{ price: { product: "prod_UJS4CAxWQ3djwF" } }] },
        status: "past_due",
      }),
    },
  })).then((r) => r.text());
  assertEquals(recorder.updates.length, 1);
  assertEquals(recorder.updates[0].patch.plan_id, "plan-business");
  assertEquals(recorder.updates[0].patch.status, "past_due");
});

Deno.test("customer.subscription.deleted → records canceled_at", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "customer.subscription.deleted",
    data: {
      object: subscriptionObject({
        status: "canceled",
        canceled_at: 1700500000,
      }),
    },
  })).then((r) => r.text());
  assertEquals(recorder.updates.length, 1);
  assertEquals(recorder.updates[0].patch.status, "canceled");
  assertEquals(
    recorder.updates[0].patch.canceled_at,
    new Date(1700500000 * 1000).toISOString(),
  );
});

Deno.test("checkout.session.completed → retrieves subscription and upserts", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "checkout.session.completed",
    data: { object: { subscription: "sub_from_checkout" } },
  })).then((r) => r.text());
  assertEquals(recorder.updates.length, 1);
  assertEquals(recorder.updates[0].patch.stripe_subscription_id, "sub_from_checkout");
});

Deno.test("checkout.session.completed without subscription → no update", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "checkout.session.completed",
    data: { object: { subscription: null } },
  })).then((r) => r.text());
  assertEquals(recorder.updates.length, 0);
});

Deno.test("invoice.paid → marks subscription active by customer id", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "invoice.paid",
    data: { object: { customer: "cus_test" } },
  })).then((r) => r.text());
  assertEquals(recorder.customerUpdates.length, 1);
  assertEquals(recorder.customerUpdates[0].customerId, "cus_test");
  assertEquals(recorder.customerUpdates[0].patch.status, "active");
});

Deno.test("invoice.payment_succeeded → marks subscription active", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "invoice.payment_succeeded",
    data: { object: { customer: "cus_test" } },
  })).then((r) => r.text());
  assertEquals(recorder.customerUpdates[0].patch.status, "active");
});

Deno.test("invoice.payment_failed → marks subscription past_due", async () => {
  recorder.reset();
  await handler(makeReq({
    type: "invoice.payment_failed",
    data: { object: { customer: "cus_test" } },
  })).then((r) => r.text());
  assertEquals(recorder.customerUpdates[0].patch.status, "past_due");
});

Deno.test("unhandled event type → 200 with no updates", async () => {
  recorder.reset();
  const res = await handler(makeReq({ type: "customer.created", data: { object: {} } }));
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(recorder.updates.length, 0);
  assertEquals(recorder.customerUpdates.length, 0);
});
