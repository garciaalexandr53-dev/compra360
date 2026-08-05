import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "buscar_catalogo",
  title: "Buscar no catálogo",
  description:
    "Busca produtos no catálogo mestre do Compra360 por nome ou por código de barras (EAN).",
  inputSchema: {
    termo: z.string().trim().min(2).describe("Nome do produto ou EAN (só dígitos)."),
    limite: z.number().int().min(1).max(50).default(20).describe("Máximo de resultados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ termo, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const isEan = /^\d+$/.test(termo);
    let query = supabase
      .from("catalogo_mestre")
      .select("id, nome, ean, categoria, embalagem, fator_embalagem")
      .eq("ativo", true)
      .limit(limite ?? 20);
    query = isEan
      ? query.or(`ean.ilike.${termo}%,nome.ilike.%${termo}%`)
      : query.ilike("nome", `%${termo}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { produtos: data ?? [] },
    };
  },
});
