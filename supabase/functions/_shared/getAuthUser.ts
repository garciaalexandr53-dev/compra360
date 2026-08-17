import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Resolve o usuário autenticado a partir do header Authorization.
 *
 * Usa getClaims (validação local do JWT, sem consultar /auth/v1/user) para não
 * falhar quando a sessão já foi rotacionada/removida no servidor — caso que
 * retornava "Session not found" (403) e derrubava o checkout/portal.
 * Faz fallback para getUser apenas se as claims não trouxerem o e-mail.
 */
export async function getAuthUser(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Sessão não encontrada. Faça login novamente.");
  }
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims as Record<string, unknown> | undefined;
    if (!error && claims?.sub && typeof claims.email === "string" && claims.email) {
      return { id: String(claims.sub), email: claims.email };
    }
  } catch (_) {
    // segue para o fallback
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) {
    throw new Error("Sua sessão expirou. Saia e entre novamente para continuar.");
  }
  return { id: userData.user.id, email: userData.user.email };
}
