// Re-sincroniza todas as assinaturas do Stripe com a tabela subscriptions.
// Restrito a administradores. Suporta dry_run para simulação.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveTier, periodStart, periodEnd, unixToIso, mapStatus } from "../_shared/stripeTiers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: unknown) => {
  const d = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-RESYNC] ${step}${d}`);
};

type Acao = {
  tipo: "atualizado" | "criado" | "cancelado" | "trial_expirado" | "nao_vinculado" | "erro";
  email: string | null;
  detalhe: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY não configurada" }, 500);

    // 1. Autenticação do chamador
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 2. Precisa ser admin
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    log("Iniciado", { dryRun, caller: caller.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // 3. Planos internos
    const { data: plans } = await admin.from("plans").select("id, name");
    const planIdByName = new Map((plans ?? []).map((p) => [p.name as string, p.id as string]));

    // 4. Todas as assinaturas do Stripe (paginado)
    const stripeSubs: Stripe.Subscription[] = [];
    let startingAfter: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await stripe.subscriptions.list({
        status: "all",
        limit: 100,
        expand: ["data.customer"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      stripeSubs.push(...page.data);
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    log("Assinaturas no Stripe", { total: stripeSubs.length });

    const acoes: Acao[] = [];
    const customersAtivos = new Set<string>();

    for (const sub of stripeSubs) {
      const customer = sub.customer as Stripe.Customer | string;
      const customerId = typeof customer === "string" ? customer : customer.id;
      const customerEmail =
        typeof customer === "string" ? null : (customer.email ?? null);

      const item = sub.items.data[0];
      const productId = item?.price?.product as string | undefined;
      const priceId = item?.price?.id as string | undefined;
      const tier = resolveTier(productId, priceId);
      const status = mapStatus(sub.status);
      if (status === "active" || status === "trialing") customersAtivos.add(customerId);

      // Localiza a linha: por stripe_customer_id, senão pelo e-mail do customer
      let row: { id: string; user_id: string } | null = null;
      const { data: byCustomer } = await admin
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      row = byCustomer ?? null;

      let userId: string | null = row?.user_id ?? null;

      if (!row && customerEmail) {
        const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const match = usersPage?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === customerEmail.toLowerCase(),
        );
        if (match) {
          userId = match.id;
          const { data: byUser } = await admin
            .from("subscriptions")
            .select("id, user_id")
            .eq("user_id", match.id)
            .maybeSingle();
          row = byUser ?? null;
        }
      }

      if (!userId) {
        acoes.push({
          tipo: "nao_vinculado",
          email: customerEmail,
          detalhe: `Cliente Stripe ${customerId} sem usuário correspondente`,
        });
        continue;
      }

      if (!tier) {
        acoes.push({
          tipo: "erro",
          email: customerEmail,
          detalhe: `Produto/preço não mapeado (${productId ?? "?"} / ${priceId ?? "?"})`,
        });
        continue;
      }

      const planId = planIdByName.get(tier);
      if (!planId) {
        acoes.push({ tipo: "erro", email: customerEmail, detalhe: `Plano "${tier}" não existe no banco` });
        continue;
      }

      const payload: Record<string, unknown> = {
        user_id: userId,
        plan_id: planId,
        status,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        canceled_at: unixToIso(sub.canceled_at),
        updated_at: new Date().toISOString(),
      };
      const ini = periodStart(sub);
      const fim = periodEnd(sub);
      if (ini) payload.current_period_start = ini;
      if (fim) payload.current_period_end = fim;

      if (row) {
        if (!dryRun) {
          const { error } = await admin.from("subscriptions").update(payload).eq("id", row.id);
          if (error) {
            acoes.push({ tipo: "erro", email: customerEmail, detalhe: error.message });
            continue;
          }
        }
        acoes.push({
          tipo: "atualizado",
          email: customerEmail,
          detalhe: `${tier} / ${status}${fim ? ` até ${fim.slice(0, 10)}` : ""}`,
        });
      } else {
        if (!dryRun) {
          const { error } = await admin.from("subscriptions").insert(payload);
          if (error) {
            acoes.push({ tipo: "erro", email: customerEmail, detalhe: error.message });
            continue;
          }
        }
        acoes.push({ tipo: "criado", email: customerEmail, detalhe: `${tier} / ${status}` });
      }
    }

    // 5. Linhas com assinatura Stripe que já não está ativa -> cancelar
    const { data: comStripe } = await admin
      .from("subscriptions")
      .select("id, user_id, stripe_customer_id, status")
      .not("stripe_customer_id", "is", null)
      .in("status", ["active", "trialing", "past_due"]);

    for (const r of comStripe ?? []) {
      if (r.stripe_customer_id && !customersAtivos.has(r.stripe_customer_id)) {
        if (!dryRun) {
          await admin
            .from("subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("id", r.id);
        }
        acoes.push({
          tipo: "cancelado",
          email: null,
          detalhe: `Sem assinatura ativa no Stripe (${r.stripe_customer_id})`,
        });
      }
    }

    // 6. Trials internos vencidos (sem Stripe) -> cancelar
    const agora = new Date().toISOString();
    const { data: trials } = await admin
      .from("subscriptions")
      .select("id, user_id, current_period_end")
      .is("stripe_customer_id", null)
      .in("status", ["active", "trialing"])
      .lt("current_period_end", agora);

    for (const t of trials ?? []) {
      if (!dryRun) {
        await admin
          .from("subscriptions")
          .update({ status: "canceled", updated_at: agora })
          .eq("id", t.id);
      }
      acoes.push({
        tipo: "trial_expirado",
        email: null,
        detalhe: `Trial vencido em ${String(t.current_period_end ?? "").slice(0, 10)}`,
      });
    }

    const conta = (tipo: Acao["tipo"]) => acoes.filter((a) => a.tipo === tipo).length;
    const resumo = {
      dry_run: dryRun,
      total_stripe: stripeSubs.length,
      atualizados: conta("atualizado"),
      criados: conta("criado"),
      cancelados: conta("cancelado"),
      trials_expirados: conta("trial_expirado"),
      nao_vinculados: conta("nao_vinculado"),
      erros: conta("erro"),
    };
    log("Concluído", resumo);

    return json({ ...resumo, acoes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERRO", { msg });
    return json({ error: msg }, 500);
  }
});
