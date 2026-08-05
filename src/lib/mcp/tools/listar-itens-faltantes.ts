import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_itens_faltantes",
  title: "Listar itens faltantes",
  description:
    "Lista os itens de reposição registrados pela equipe da loja (produtos em falta), pendentes ou já importados para cotação.",
  inputSchema: {
    loja_id: z.string().uuid().optional().describe("Filtrar por loja (unidade)."),
    apenas_pendentes: z.boolean().default(true).describe("Se verdadeiro, retorna só os itens ainda não importados."),
    limite: z.number().int().min(1).max(200).default(100).describe("Máximo de itens a retornar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ loja_id, apenas_pendentes, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("itens_faltantes")
      .select("id, nome, ean, quantidade, embalagem, fator_embalagem, observacao, registrado_por, importado, loja_id, created_at, lojas(nome)")
      .order("created_at", { ascending: false })
      .limit(limite ?? 100);
    if (loja_id) query = query.eq("loja_id", loja_id);
    if (apenas_pendentes !== false) query = query.eq("importado", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { itens: data ?? [] },
    };
  },
});
