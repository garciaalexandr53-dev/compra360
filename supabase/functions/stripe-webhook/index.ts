import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  TIERS_BY_PRODUCT as TIERS,
  TIERS_BY_PRICE,
  unixToIso,
  periodStart,
  periodEnd,
} from "../_shared/stripeTiers.ts";



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

    // 1) Tenta pelo stripe_customer_id já salvo
    const { data: byCustomer } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    let existing = byCustomer ?? null;
    let userId: string | null = existing?.user_id ?? null;

    // 2) Fallback: casa pelo e-mail do customer no Stripe
    if (!existing) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer)?.email ?? null;
        if (email) {
          const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const match = usersPage?.users?.find(
            (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
          );
          if (match) {
            userId = match.id;
            const { data: byUser } = await supabase
              .from("subscriptions")
              .select("id, user_id")
              .eq("user_id", match.id)
              .maybeSingle();
            existing = byUser ?? null;
          }
        }
      } catch (e) {
        logStep("Customer lookup failed", { customerId, msg: e instanceof Error ? e.message : String(e) });
      }
    }

    if (!userId) {
      logStep("No matching user for customer", { customerId });
      return;
    }

    const startIso = periodStart(sub);
    const endIso = periodEnd(sub);
    const payload: Record<string, unknown> = {
      status: mapStatus(sub.status),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      canceled_at: unixToIso(sub.canceled_at),
      updated_at: new Date().toISOString(),
    };
    if (startIso) payload.current_period_start = startIso;
    if (endIso) payload.current_period_end = endIso;
    if (planId) payload.plan_id = planId;

    if (existing) {
      await supabase.from("subscriptions").update(payload).eq("id", existing.id);
    } else if (planId) {
      await supabase.from("subscriptions").insert({ ...payload, user_id: userId });
    } else {
      logStep("Skipping insert without plan", { customerId });
      return;
    }
    logStep("Subscription synced", { customerId, status: sub.status, tier });

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
