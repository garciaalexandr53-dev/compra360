import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Valida JWT do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // 2. Chamador precisa ser admin
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Acesso restrito a administradores" }, 403);

    // 3. Valida entrada
    const body = await req.json().catch(() => null);
    const targetId = body?.user_id;
    const confirmCurrent =
      typeof body?.confirm_current_email === "string"
        ? body.confirm_current_email.trim().toLowerCase()
        : "";
    const newEmail = typeof body?.new_email === "string" ? body.new_email.trim().toLowerCase() : "";
    const updateStripe = body?.update_stripe !== false;

    if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
      return json({ error: "user_id inválido" }, 400);
    }
    if (!EMAIL_RE.test(newEmail)) {
      return json({ error: "O novo e-mail não é válido" }, 400);
    }

    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(targetId);
    if (targetErr || !target?.user) return json({ error: "Usuário não encontrado" }, 404);

    const currentEmail = (target.user.email ?? "").toLowerCase();
    if (!confirmCurrent || confirmCurrent !== currentEmail) {
      return json({ error: "A confirmação do e-mail atual não corresponde" }, 400);
    }
    if (newEmail === currentEmail) {
      return json({ error: "O novo e-mail é igual ao atual" }, 400);
    }

    // 4. Nunca alterar outro administrador
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      return json({ error: "Não é possível alterar o e-mail de uma conta de administrador" }, 403);
    }

    // 5. Verifica colisão de e-mail
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const collision = (existing?.users ?? []).some(
      (u: { id: string; email?: string | null }) =>
        u.id !== targetId && (u.email ?? "").toLowerCase() === newEmail,
    );
    if (collision) {
      return json({ error: "Este e-mail já está em uso por outra conta" }, 409);
    }

    // 6. Troca o e-mail já confirmado (login imediato, sem reconfirmação)
    const { error: updErr } = await admin.auth.admin.updateUserById(targetId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) {
      const msg = /already|exists|registered/i.test(updErr.message)
        ? "Este e-mail já está em uso por outra conta"
        : updErr.message;
      return json({ error: msg }, 400);
    }

    // 7. Stripe (best-effort, não desfaz a troca)
    let stripeUpdated = false;
    let stripeError: string | null = null;
    if (updateStripe) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        stripeError = "STRIPE_SECRET_KEY não configurada";
      } else {
        try {
          const search = await fetch(
            `https://api.stripe.com/v1/customers?limit=1&email=${encodeURIComponent(currentEmail)}`,
            { headers: { Authorization: `Bearer ${stripeKey}` } },
          );
          const found = await search.json();
          const customerId = found?.data?.[0]?.id;
          if (!customerId) {
            stripeError = "Nenhum cliente encontrado no Stripe com o e-mail antigo";
          } else {
            const upd = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ email: newEmail }),
            });
            if (upd.ok) {
              stripeUpdated = true;
            } else {
              stripeError = `Stripe retornou ${upd.status}`;
            }
          }
        } catch (e) {
          stripeError = e instanceof Error ? e.message : "Falha ao falar com o Stripe";
        }
      }
    }

    console.log(
      `admin ${caller.id} changed email of user ${targetId}: ${currentEmail} -> ${newEmail} (stripe=${stripeUpdated})`,
    );

    return json({
      success: true,
      old_email: currentEmail,
      new_email: newEmail,
      stripe_updated: stripeUpdated,
      stripe_error: stripeError,
    });
  } catch (e) {
    console.error("admin-change-user-email error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
