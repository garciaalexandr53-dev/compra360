import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type PrecoRow = { preco: number | null; fornecedor_id: string | null };

export default defineTool({
  name: "detalhar_cotacao",
  title: "Detalhar cotação",
  description:
    "Retorna os itens de uma cotação com quantidades, embalagem e os preços recebidos de cada fornecedor, incluindo o menor preço por item.",
  inputSchema: {
    cotacao_id: z.string().uuid().describe("ID da cotação (use listar_cotacoes para obter)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ cotacao_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: cotacao, error: cotacaoError } = await supabase
      .from("cotacoes")
      .select("id, nome, status, loja_id, prazo_resposta, created_at")
      .eq("id", cotacao_id)
      .maybeSingle();
    if (cotacaoError) return { content: [{ type: "text", text: cotacaoError.message }], isError: true };
    if (!cotacao) {
      return { content: [{ type: "text", text: "Cotação não encontrada." }], isError: true };
    }

    const [{ data: itens, error: itensError }, { data: fornecedores }] = await Promise.all([
      supabase
        .from("cotacao_produtos")
        .select("id, nome, ean, quantidade, tipo_embalagem, fator_embalagem, precos(preco, fornecedor_id)")
        .eq("cotacao_id", cotacao_id)
        .order("nome", { ascending: true }),
      supabase.from("fornecedores").select("id, nome"),
    ]);
    if (itensError) return { content: [{ type: "text", text: itensError.message }], isError: true };

    const nomeFornecedor = new Map((fornecedores ?? []).map((f) => [f.id, f.nome]));

    const resultado = (itens ?? []).map((item) => {
      const precos = ((item as unknown as { precos: PrecoRow[] }).precos ?? [])
        .filter((p) => typeof p.preco === "number")
        .map((p) => ({
          fornecedor_id: p.fornecedor_id,
          fornecedor: p.fornecedor_id ? nomeFornecedor.get(p.fornecedor_id) ?? null : null,
          preco: p.preco as number,
        }))
        .sort((a, b) => a.preco - b.preco);
      return {
        id: item.id,
        nome: item.nome,
        ean: item.ean,
        quantidade: item.quantidade,
        embalagem: item.tipo_embalagem,
        fator_embalagem: item.fator_embalagem,
        precos,
        melhor_preco: precos[0] ?? null,
      };
    });

    const payload = { cotacao, total_itens: resultado.length, itens: resultado };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
