// Admin-only endpoint that aggregates Stripe subscriptions and invoices data.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-DADOS] ${step}${d}`);
};

type SubscriptionRow = {
  id: string;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  status: string;
  plan_nickname: string | null;
  plan_amount: number;
  plan_currency: string;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
};

type InvoiceRow = {
  id: string;
  number: string | null;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  created: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Parse query params
    const url = new URL(req.url);
    const invoicesDays = Math.max(
      1,
      Math.min(365, parseInt(url.searchParams.get("invoices_days") || "30", 10)),
    );

    // List subscriptions (all statuses, last 100)
    const subsResp = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
    });
    log("Subscriptions fetched", { count: subsResp.data.length });

    const subscriptions: SubscriptionRow[] = subsResp.data.map((s) => {
      const item = s.items.data[0];
      const price = item?.price;
      const customer = typeof s.customer === "string" ? null : s.customer;
      return {
        id: s.id,
        customer_id: typeof s.customer === "string" ? s.customer : s.customer.id,
        customer_email: customer && "email" in customer ? customer.email ?? null : null,
        customer_name: customer && "name" in customer ? customer.name ?? null : null,
        status: s.status,
        plan_nickname: price?.nickname ?? null,
        plan_amount: price?.unit_amount ?? 0,
        plan_currency: price?.currency ?? "brl",
        current_period_end: (s as any).current_period_end ?? item?.current_period_end ?? null,
        cancel_at_period_end: s.cancel_at_period_end,
      };
    });

    // List recent invoices
    const sinceTs = Math.floor((Date.now() - invoicesDays * 86400000) / 1000);
    const invResp = await stripe.invoices.list({
      limit: 30,
      created: { gte: sinceTs },
      expand: ["data.customer"],
    });
    log("Invoices fetched", { count: invResp.data.length });

    const invoices: InvoiceRow[] = invResp.data.map((inv) => {
      const customer = typeof inv.customer === "string" ? null : inv.customer;
      return {
        id: inv.id ?? "",
        number: inv.number,
        customer_id: typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "",
        customer_email:
          inv.customer_email ??
          (customer && "email" in customer ? customer.email ?? null : null),
        customer_name: customer && "name" in customer ? customer.name ?? null : null,
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status ?? "unknown",
        hosted_invoice_url: inv.hosted_invoice_url,
        created: inv.created,
      };
    });

    // Compute summary
    const now = new Date();
    const monthStart = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
    );

    // For "recebido no mês" we want all paid invoices this month, fetch a wider window
    const monthInvoicesResp = await stripe.invoices.list({
      limit: 100,
      created: { gte: monthStart },
    });
    const recebidoMes = monthInvoicesResp.data
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount_paid, 0);

    const inadimplente = invoices
      .filter((i) => i.status === "open" || i.status === "uncollectible")
      .reduce((sum, i) => sum + i.amount_due, 0);

    const in30 = Math.floor((Date.now() + 30 * 86400000) / 1000);
    const proximasCobrancas = subscriptions
      .filter(
        (s) =>
          (s.status === "active" || s.status === "trialing") &&
          s.current_period_end &&
          s.current_period_end <= in30,
      )
      .reduce((sum, s) => sum + s.plan_amount, 0);

    const assinaturasAtivas = subscriptions.filter(
      (s) => s.status === "active" || s.status === "trialing",
    ).length;

    return new Response(
      JSON.stringify({
        summary: {
          recebido_mes: recebidoMes,
          inadimplente,
          proximas_cobrancas_30d: proximasCobrancas,
          assinaturas_ativas: assinaturasAtivas,
          currency: "brl",
        },
        subscriptions,
        invoices,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
