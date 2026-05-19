import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const TIERS: Record<string, string> = {
  prod_UJS4YQNTiMkNEO: "pro",
  prod_UJS4CAxWQ3djwF: "business",
};

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
    const tier = TIERS[productId];

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

    const update: Record<string, unknown> = {
      status: sub.status,
      stripe_subscription_id: sub.id,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
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
