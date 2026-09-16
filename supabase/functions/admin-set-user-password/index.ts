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
    const action = body?.action === "send_reset_link" ? "send_reset_link" : "set_password";
    const confirmCurrent =
      typeof body?.confirm_current_email === "string"
        ? body.confirm_current_email.trim().toLowerCase()
        : "";
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
    const redirectTo = typeof body?.redirect_to === "string" ? body.redirect_to : "";

    if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
      return json({ error: "user_id inválido" }, 400);
    }

    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(targetId);
    if (targetErr || !target?.user) return json({ error: "Usuário não encontrado" }, 404);

    const currentEmail = (target.user.email ?? "").toLowerCase();
    if (!confirmCurrent || confirmCurrent !== currentEmail) {
      return json({ error: "A confirmação do e-mail atual não corresponde" }, 400);
    }

    // 4. Nunca alterar outro administrador
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      return json({ error: "Não é possível alterar a senha de uma conta de administrador" }, 403);
    }

    if (action === "send_reset_link") {
      const { error: resetErr } = await authClient.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: /^https?:\/\//.test(redirectTo) ? redirectTo : undefined,
      });
      if (resetErr) return json({ error: resetErr.message }, 400);
      console.log(`admin ${caller.id} sent reset link to user ${targetId}`);
      return json({ success: true, action, email: currentEmail });
    }

    if (newPassword.length < 8) {
      return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(targetId, {
      password: newPassword,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    console.log(`admin ${caller.id} set a temporary password for user ${targetId}`);
    return json({ success: true, action, email: currentEmail });
  } catch (e) {
    console.error("admin-set-user-password error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
