import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_lojas",
  title: "Listar lojas",
  description: "Lista as lojas (unidades) do usuário autenticado no Compra360.",
  inputSchema: {
    limite: z.number().int().min(1).max(100).default(50).describe("Máximo de lojas a retornar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("lojas")
      .select("id, nome, nome_fantasia, cnpj, telefone, endereco, created_at")
      .order("created_at", { ascending: true })
      .limit(limite ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { lojas: data ?? [] },
    };
  },
});
