import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Stripe product_id -> internal plan name
const TIERS: Record<string, string> = {
  // Produção (live)
  prod_UYfyII4JC0pj09: "pro", // Compra360 Pro (mensal)
  prod_UYgEdk6iT58nVq: "pro", // Compra360 Pro (anual)
  prod_UYgHaqHI56ZhCg: "business", // Compra360 Business (mensal)
  prod_UYgIdiTdFac5BR: "business", // Compra360 Business (anual)
  // Teste (mantidos para não quebrar assinaturas antigas)
  prod_UJS4YQNTiMkNEO: "pro",
  prod_UJS4CAxWQ3djwF: "business",
};

// Stripe price_id -> internal plan name (fallback)
const TIERS_BY_PRICE: Record<string, string> = {
  price_1TZYctRsAnnCWikuFoi74yDA: "pro",
  price_1TZYrmRsAnnCWikupP0T8XEL: "pro",
  price_1TZYusRsAnnCWikuRWNE0cJ6: "business",
  price_1TZYvrRsAnnCWikueV1dORha: "business",
  price_1TKpAoRqa8H38ghzHoJp4PWR: "pro",
  price_1TKpAORqa8H38ghzur73xJl8: "business",
  price_1TYyddRqa8H38ghzos78Tvwq: "pro",
  price_1TYykORqa8H38ghznsu67izE: "business",
};

// Stripe moved current_period_* onto subscription items in newer API versions
const unixToIso = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;
const periodStart = (sub: any): string | null =>
  unixToIso(sub?.current_period_start ?? sub?.items?.data?.[0]?.current_period_start);
const periodEnd = (sub: any): string | null =>
  unixToIso(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end);


const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Missing Stripe env vars", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? "", webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Signature verification failed", { msg });
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const upsertSubscription = async (sub: Stripe.Subscription) => {
    const customerId = sub.customer as string;
    const productId = sub.items.data[0]?.price.product as string;
    const priceId = sub.items.data[0]?.price.id as string | undefined;
    const tier = TIERS[productId] ?? (priceId ? TIERS_BY_PRICE[priceId] : undefined);


    let planId: string | null = null;
    if (tier) {
      const { data: plan } = await supabase
        .from("plans")
        .select("id")
        .eq("name", tier)
        .single();
      planId = plan?.id ?? null;
    }

    // Find user by existing subscription customer id
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (!existing) {
      logStep("No matching subscription row for customer", { customerId });
      return;
    }

    const startIso = periodStart(sub);
    const endIso = periodEnd(sub);
    const update: Record<string, unknown> = {
      status: sub.status,
      stripe_subscription_id: sub.id,
      canceled_at: unixToIso(sub.canceled_at),
      updated_at: new Date().toISOString(),
    };
    if (startIso) update.current_period_start = startIso;
    if (endIso) update.current_period_end = endIso;
    if (planId) update.plan_id = planId;


    await supabase.from("subscriptions").update(update).eq("id", existing.id);
    logStep("Subscription updated", { customerId, status: sub.status, tier });
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await supabase
          .from("subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", customerId);
        logStep("Invoice paid", { customerId });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_customer_id", customerId);
        logStep("Invoice payment failed", { customerId });
        break;
      }
      default:
        logStep("Unhandled event", { type: event.type });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Handler error", { msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
