import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "registrar_item_faltante",
  title: "Registrar item faltante",
  description:
    "Registra um produto em falta na fila de reposição de uma loja, para depois ser importado em uma cotação.",
  inputSchema: {
    loja_id: z.string().uuid().describe("ID da loja (use listar_lojas)."),
    nome: z.string().trim().min(2).describe("Nome do produto em falta."),
    quantidade: z.number().int().min(1).default(1).describe("Quantidade necessária."),
    embalagem: z.string().trim().min(1).optional().describe("Embalagem, ex: UN, CX, FD."),
    fator_embalagem: z.number().int().min(1).optional().describe("Quantas unidades por embalagem."),
    ean: z.string().trim().optional().describe("Código de barras, se conhecido."),
    observacao: z.string().trim().max(500).optional().describe("Observação livre."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("itens_faltantes")
      .insert({
        loja_id: input.loja_id,
        nome: input.nome,
        quantidade: input.quantidade ?? 1,
        embalagem: input.embalagem ?? null,
        fator_embalagem: input.fator_embalagem ?? null,
        ean: input.ean ?? null,
        observacao: input.observacao ?? null,
        registrado_por: ctx.getUserEmail() ?? "Assistente (MCP)",
        importado: false,
      })
      .select("id, nome, quantidade, embalagem, fator_embalagem, loja_id")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { item: data },
    };
  },
});
