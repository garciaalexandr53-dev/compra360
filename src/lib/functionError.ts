/**
 * Extrai a mensagem real de erro de uma Edge Function.
 * O supabase-js lança apenas "Edge Function returned a non-2xx status code";
 * a mensagem útil está no corpo da resposta (err.context).
 */
export async function mensagemErroFuncao(err: unknown, fallback = "tente novamente"): Promise<string> {
  const ctx = (err as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return String(body.error);
    } catch {
      try {
        const txt = await (ctx as Response).clone().text();
        if (txt) return txt.slice(0, 200);
      } catch {
        /* ignora */
      }
    }
  }
  const msg = (err as { message?: string })?.message;
  if (msg && !msg.includes("non-2xx")) return msg;
  return fallback;
}
