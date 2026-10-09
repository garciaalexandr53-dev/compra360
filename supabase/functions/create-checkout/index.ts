import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getAuthUser } from "../_shared/getAuthUser.ts";
import { pixPriceFor, PIX_PRICES } from "../_shared/pixAnual.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req);
    console.log("[CREATE-CHECKOUT] user", user.id);

    const { priceId, metodo } = await req.json();
    if (!priceId || typeof priceId !== "string") throw new Error("priceId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://compra360.lovable.app";

    let session;
    if (metodo === "pix") {
      const pixPrice = pixPriceFor(priceId);
      if (!pixPrice) {
        return new Response(JSON.stringify({ error: "Pix disponível apenas no plano anual" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      // Bloqueia Pix se já existe assinatura no cartão ativa (evita cobrança dupla e
      // o plano voltar ao anterior na renovação do cartão).
      if (customerId) {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
        const ativa = subs.data.some((s) => ["active", "trialing", "past_due"].includes(s.status));
        if (ativa) {
          return new Response(JSON.stringify({
            error: "Você já tem uma assinatura no cartão. Para mudar de plano, use 'Gerenciar assinatura' ou fale com o suporte no WhatsApp (44) 98448-3553.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }
      }
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: pixPrice, quantity: 1 }],
        mode: "payment",
        payment_method_types: ["pix"],
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/dashboard?checkout=cancel`,
        metadata: { user_id: user.id, plano: PIX_PRICES[pixPrice], origem: "pix" },
      });
    } else {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/dashboard?checkout=cancel`,
        metadata: { user_id: user.id },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT] erro", msg);
    return new Response(JSON.stringify({ error: msg }), {

      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
