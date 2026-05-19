import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe product_id -> internal plan name
const TIERS_BY_PRODUCT: Record<string, string> = {
  prod_UJS4YQNTiMkNEO: "pro",
  prod_UJS4CAxWQ3djwF: "business",
};

// Map Stripe price_id -> internal plan name (fallback / explicit)
const TIERS_BY_PRICE: Record<string, string> = {
  price_1TKpAORqa8H38ghzur73xJl8: "pro",
  price_1TKpAoRqa8H38ghzHoJp4PWR: "business",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

// Safely extract a unix-seconds period_end from a Stripe subscription
// (Stripe moved current_period_end onto items in newer API versions.)
const extractPeriodEnd = (sub: any): number | null => {
  return (
    sub?.current_period_end ??
    sub?.items?.data?.[0]?.current_period_end ??
    null
  );
};
const extractPeriodStart = (sub: any): number | null => {
  return (
    sub?.current_period_start ??
    sub?.items?.data?.[0]?.current_period_start ??
    null
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    log("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (customers.data.length === 0) {
      log("No Stripe customer for email");
      return new Response(
        JSON.stringify({ subscribed: false, plan: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = customers.data[0].id;
    log("Found Stripe customer", { customerId });

    // Look at all (non-deleted) subscriptions, prefer active/trialing
    const allSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const activeSub =
      allSubs.data.find((s) => s.status === "active") ??
      allSubs.data.find((s) => s.status === "trialing") ??
      null;

    if (!activeSub) {
      log("No active subscription in Stripe");
      await supabaseClient
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"]);

      return new Response(
        JSON.stringify({ subscribed: false, plan: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const item = activeSub.items.data[0];
    const productId = item?.price?.product as string | undefined;
    const priceId = item?.price?.id as string | undefined;
    const tier =
      (productId && TIERS_BY_PRODUCT[productId]) ||
      (priceId && TIERS_BY_PRICE[priceId]) ||
      null;

    const periodEndUnix = extractPeriodEnd(activeSub);
    const periodStartUnix = extractPeriodStart(activeSub);
    const subscriptionEnd = periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;
    const subscriptionStart = periodStartUnix
      ? new Date(periodStartUnix * 1000).toISOString()
      : null;
    const isTrial = activeSub.status === "trialing";

    log("Active subscription found", {
      subId: activeSub.id,
      status: activeSub.status,
      productId,
      priceId,
      tier,
      subscriptionEnd,
    });

    // Sync to DB only if we recognise the tier
    if (tier) {
      const { data: planRow, error: planErr } = await supabaseClient
        .from("plans")
        .select("id")
        .eq("name", tier)
        .maybeSingle();

      if (planErr) log("plans lookup error", { msg: planErr.message });

      if (planRow) {
        const { data: existingSub } = await supabaseClient
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const subData: Record<string, unknown> = {
          user_id: user.id,
          plan_id: planRow.id,
          status: isTrial ? "trialing" : "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: activeSub.id,
          updated_at: new Date().toISOString(),
        };
        if (subscriptionStart) subData.current_period_start = subscriptionStart;
        if (subscriptionEnd) subData.current_period_end = subscriptionEnd;

        if (existingSub) {
          const { error: upErr } = await supabaseClient
            .from("subscriptions")
            .update(subData)
            .eq("id", existingSub.id);
          if (upErr) log("subscription update error", { msg: upErr.message });
        } else {
          const { error: insErr } = await supabaseClient
            .from("subscriptions")
            .insert(subData);
          if (insErr) log("subscription insert error", { msg: insErr.message });
        }
      } else {
        log("No matching plan row in DB for tier", { tier });
      }
    } else {
      log("Unknown tier — not syncing", { productId, priceId });
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan: tier ?? "unknown",
        tier: tier ?? "unknown",
        product_id: productId ?? null,
        price_id: priceId ?? null,
        subscription_end: subscriptionEnd,
        is_trial: isTrial,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
