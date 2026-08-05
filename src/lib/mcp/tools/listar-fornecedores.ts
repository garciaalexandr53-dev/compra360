import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_fornecedores",
  title: "Listar fornecedores",
  description: "Lista os fornecedores cadastrados do usuário, com pedido mínimo e prazo de pagamento.",
  inputSchema: {
    busca: z.string().trim().min(1).optional().describe("Filtro por parte do nome do fornecedor."),
    limite: z.number().int().min(1).max(200).default(50).describe("Máximo de fornecedores a retornar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("fornecedores")
      .select("id, nome, representante, telefone, email, pedido_minimo, prazo_pagamento, observacoes")
      .order("nome", { ascending: true })
      .limit(limite ?? 50);
    if (busca) query = query.ilike("nome", `%${busca}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { fornecedores: data ?? [] },
    };
  },
});
