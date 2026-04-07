import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, cotacao_id, loja_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch cotação context
    let contextText = "Nenhuma cotação ativa encontrada.";

    if (cotacao_id) {
      // Fetch products with prices
      const { data: cotacaoProdutos } = await supabase
        .from("cotacao_produtos")
        .select("id, quantidade, produtos(nome, embalagem, categorias(nome))")
        .eq("cotacao_id", cotacao_id);

      // Fetch selected suppliers
      const { data: cotacaoFornecedores } = await supabase
        .from("cotacao_fornecedores")
        .select("fornecedor_id, fornecedores(nome, pedido_minimo, telefone)")
        .eq("cotacao_id", cotacao_id);

      const cpIds = (cotacaoProdutos || []).map((cp: any) => cp.id);
      let precos: any[] = [];
      if (cpIds.length > 0) {
        const { data } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
        precos = data || [];
      }

      // Build context
      const fornecedorMap: Record<string, string> = {};
      (cotacaoFornecedores || []).forEach((cf: any) => {
        fornecedorMap[cf.fornecedor_id] = cf.fornecedores?.nome || "Desconhecido";
      });

      const lines: string[] = [];
      lines.push(`Cotação ativa com ${(cotacaoProdutos || []).length} produtos e ${(cotacaoFornecedores || []).length} fornecedores.`);
      lines.push("");
      lines.push("Fornecedores participantes:");
      (cotacaoFornecedores || []).forEach((cf: any) => {
        const f = cf.fornecedores;
        lines.push(`- ${f?.nome || "?"} (pedido mínimo: R$${f?.pedido_minimo || 0})`);
      });

      lines.push("");
      lines.push("Produtos e preços:");
      (cotacaoProdutos || []).forEach((cp: any) => {
        const prod = cp.produtos;
        const cat = prod?.categorias?.nome || "Sem categoria";
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
        const precosStr = cpPrecos
          .map((p: any) => `${fornecedorMap[p.fornecedor_id] || "?"}: R$${Number(p.preco).toFixed(2)}`)
          .join(", ");
        lines.push(
          `- ${prod?.nome} [${cat}] (emb: ${prod?.embalagem || "-"}, qtd: ${cp.quantidade || 1}) → ${precosStr || "sem preço"}`
        );
      });

      // Compute totals per supplier
      lines.push("");
      lines.push("Resumo por fornecedor (menor preço vence cada item):");
      const supplierWins: Record<string, { wins: number; total: number }> = {};
      (cotacaoProdutos || []).forEach((cp: any) => {
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
        if (!cpPrecos.length) return;
        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        const winner = cpPrecos.find((p: any) => p.preco === minPrice);
        if (winner) {
          if (!supplierWins[winner.fornecedor_id]) supplierWins[winner.fornecedor_id] = { wins: 0, total: 0 };
          supplierWins[winner.fornecedor_id].wins++;
          supplierWins[winner.fornecedor_id].total += minPrice * (cp.quantidade || 1);
        }
      });
      Object.entries(supplierWins).forEach(([fid, s]) => {
        lines.push(`- ${fornecedorMap[fid] || "?"}: ${s.wins} itens ganhos, total R$${s.total.toFixed(2)}`);
      });

      const grandTotal = Object.values(supplierWins).reduce((acc, s) => acc + s.total, 0);
      lines.push(`\nTotal geral estimado da compra: R$${grandTotal.toFixed(2)}`);

      contextText = lines.join("\n");
    }

    const systemPrompt = `Você é o assistente de compras do Compra360. Responda sempre em português brasileiro, de forma objetiva e útil.
Você tem acesso aos dados reais da cotação ativa do comprador. Use esses dados para responder perguntas sobre preços, fornecedores, economia e recomendações.

DADOS DA COTAÇÃO ATIVA:
${contextText}

REGRAS:
- Sempre baseie suas respostas nos dados acima.
- Use formato monetário brasileiro (R$ X,XX).
- Seja conciso mas completo.
- Se não tiver dados suficientes, diga isso claramente.
- Quando perguntar sobre economia, compare os preços entre fornecedores.
- Ao recomendar, considere pedido mínimo dos fornecedores.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-cotacao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
