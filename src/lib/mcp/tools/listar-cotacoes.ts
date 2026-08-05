import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_cotacoes",
  title: "Listar cotações",
  description: "Lista as cotações do usuário (ativas e finalizadas), com loja, status e prazo de resposta.",
  inputSchema: {
    status: z.enum(["ativa", "finalizada"]).optional().describe("Filtrar por status da cotação."),
    loja_id: z.string().uuid().optional().describe("Filtrar por loja (unidade)."),
    limite: z.number().int().min(1).max(50).default(10).describe("Máximo de cotações a retornar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, loja_id, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("cotacoes")
      .select("id, nome, status, loja_id, prazo_resposta, created_at, finalizada_at, lojas(nome)")
      .order("created_at", { ascending: false })
      .limit(limite ?? 10);
    if (status) query = query.eq("status", status);
    if (loja_id) query = query.eq("loja_id", loja_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { cotacoes: data ?? [] },
    };
  },
});
