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

    // 1. Validate caller JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autenticado" }, 401);

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    const caller = userData?.user;
    if (userErr || !caller) return json({ error: "Não autenticado" }, 401);

    // 2. Service client for privileged work
    const admin = createClient(supabaseUrl, serviceKey);

    // 3. Caller must be admin
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) return json({ error: "Acesso restrito a administradores" }, 403);

    // 4. Validate input
    const body = await req.json().catch(() => null);
    const targetId = body?.user_id;
    const confirmEmail = typeof body?.confirm_email === "string" ? body.confirm_email.trim().toLowerCase() : "";
    if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
      return json({ error: "user_id inválido" }, 400);
    }
    if (targetId === caller.id) {
      return json({ error: "Você não pode excluir a sua própria conta" }, 400);
    }

    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(targetId);
    if (targetErr || !target?.user) return json({ error: "Usuário não encontrado" }, 404);

    const targetEmail = (target.user.email ?? "").toLowerCase();
    if (!confirmEmail || confirmEmail !== targetEmail) {
      return json({ error: "Confirmação de e-mail não corresponde ao usuário" }, 400);
    }

    // 5. Never delete another admin
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) return json({ error: "Não é possível excluir uma conta de administrador" }, 403);

    // 6. Remove data that does not cascade from auth.users
    const { data: lojas } = await admin.from("lojas").select("id").eq("user_id", targetId);
    const lojaIds = (lojas ?? []).map((l: { id: string }) => l.id);
    if (lojaIds.length > 0) {
      await admin.from("itens_faltantes").delete().in("loja_id", lojaIds);
    }

    // Orders / quotes reference the user with NO ACTION, so clear them first.
    await admin.from("pedidos").delete().eq("created_by", targetId);
    await admin.from("historico_envios").update({ executado_por: null }).eq("executado_por", targetId);
    await admin.from("cotacoes").delete().eq("created_by", targetId);

    await admin.from("subscriptions").delete().eq("user_id", targetId);
    await admin.from("trial_controls").delete().eq("user_id", targetId);
    await admin.from("admin_contatos").delete().eq("user_id", targetId);

    // 7. Delete the auth user — cascades lojas, produtos, categorias,
    //    fornecedores, profiles and user_roles.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 500);

    console.log(`admin ${caller.id} deleted user ${targetId}`);
    return json({ success: true, email: targetEmail });
  } catch (e) {
    console.error("admin-delete-user error", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
