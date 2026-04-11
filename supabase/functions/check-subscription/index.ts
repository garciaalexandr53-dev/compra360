import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIERS: Record<string, string> = {
  prod_UJS4YQNTiMkNEO: "pro",
  prod_UJS4CAxWQ3djwF: "business",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;

    // Check active + trialing
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let trialingSubs: any = { data: [] };
    if (subscriptions.data.length === 0) {
      trialingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
    }

    const activeSub = subscriptions.data[0] || trialingSubs.data[0];

    if (!activeSub) {
      // Sync: mark subscription as canceled in our DB
      await supabaseClient
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"]);

      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productId = activeSub.items.data[0].price.product as string;
    const tier = TIERS[productId] || "unknown";
    const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
    const isTrial = activeSub.status === "trialing";

    // Sync subscription to our DB
    const planRes = await supabaseClient
      .from("plans")
      .select("id")
      .eq("name", tier)
      .single();

    if (planRes.data) {
      const { data: existingSub } = await supabaseClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .single();

      const subData = {
        user_id: user.id,
        plan_id: planRes.data.id,
        status: isTrial ? "trialing" : "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: activeSub.id,
        current_period_start: new Date(activeSub.current_period_start * 1000).toISOString(),
        current_period_end: subscriptionEnd,
        updated_at: new Date().toISOString(),
      };

      if (existingSub) {
        await supabaseClient
          .from("subscriptions")
          .update(subData)
          .eq("id", existingSub.id);
      } else {
        await supabaseClient.from("subscriptions").insert(subData);
      }
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        tier,
        product_id: productId,
        subscription_end: subscriptionEnd,
        is_trial: isTrial,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
