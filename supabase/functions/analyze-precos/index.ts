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
    const { cotacao_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!cotacao_id) throw new Error("cotacao_id is required");

    // Fetch products with prices
    const { data: cotacaoProdutos } = await supabase
      .from("cotacao_produtos")
      .select("id, quantidade, produtos(nome, embalagem, categorias(nome))")
      .eq("cotacao_id", cotacao_id);

    // Fetch selected suppliers
    const { data: cotacaoFornecedores } = await supabase
      .from("cotacao_fornecedores")
      .select("fornecedor_id, fornecedores(nome, pedido_minimo)")
      .eq("cotacao_id", cotacao_id);

    const cpIds = (cotacaoProdutos || []).map((cp: any) => cp.id);
    let precos: any[] = [];
    if (cpIds.length > 0) {
      const { data } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      precos = data || [];
    }

    // Fetch historical prices (last finalized cotação)
    const { data: lastFinalized } = await supabase
      .from("cotacoes")
      .select("id")
      .eq("status", "finalizada")
      .order("finalizada_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let historicalPrices: any[] = [];
    if (lastFinalized) {
      const { data: histCps } = await supabase
        .from("cotacao_produtos")
        .select("id, produto_id")
        .eq("cotacao_id", lastFinalized.id);
      const histCpIds = (histCps || []).map((cp: any) => cp.id);
      if (histCpIds.length > 0) {
        const { data } = await supabase.from("precos").select("*").in("cotacao_produto_id", histCpIds);
        historicalPrices = data || [];
      }
    }

    // Build supplier map
    const fornecedorMap: Record<string, string> = {};
    (cotacaoFornecedores || []).forEach((cf: any) => {
      fornecedorMap[cf.fornecedor_id] = cf.fornecedores?.nome || "Desconhecido";
    });

    // Build analysis data
    const lines: string[] = [];
    lines.push(`Cotação com ${(cotacaoProdutos || []).length} produtos e ${(cotacaoFornecedores || []).length} fornecedores.\n`);

    lines.push("PRODUTOS E PREÇOS ATUAIS:");
    (cotacaoProdutos || []).forEach((cp: any) => {
      const prod = cp.produtos;
      const cat = prod?.categorias?.nome || "Sem categoria";
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
      const precosStr = cpPrecos
        .map((p: any) => `${fornecedorMap[p.fornecedor_id] || "?"}: R$${Number(p.preco).toFixed(2)}`)
        .join(", ");
      
      // Compute stats
      if (cpPrecos.length > 0) {
        const vals = cpPrecos.map((p: any) => Number(p.preco));
        const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const spread = avg > 0 ? (((max - min) / avg) * 100).toFixed(1) : "0";
        lines.push(`- ${prod?.nome} [${cat}] (emb: ${prod?.embalagem || "-"}, qtd: ${cp.quantidade || 1})`);
        lines.push(`  Preços: ${precosStr}`);
        lines.push(`  Média: R$${avg.toFixed(2)} | Min: R$${min.toFixed(2)} | Max: R$${max.toFixed(2)} | Spread: ${spread}%`);
      } else {
        lines.push(`- ${prod?.nome} [${cat}] → sem preço informado`);
      }
    });

    if (historicalPrices.length > 0) {
      lines.push("\nPREÇOS HISTÓRICOS (cotação anterior):");
      lines.push("(Disponíveis para comparação com os preços atuais)");
    }

    const contextText = lines.join("\n");

    const systemPrompt = `Você é um analista especialista em compras e detecção de preços suspeitos para o Compra360.

Analise os preços da cotação ativa e identifique:

1. **PREÇOS SUSPEITOS**: Valores muito acima ou muito abaixo dos demais fornecedores para o mesmo item. Considere:
   - Possíveis erros de digitação (ex: R$1,50 vs R$15,00)
   - Unidades diferentes (preço por kg vs por unidade)
   - Preços defasados vs mercado

2. **ANOMALIAS POR CATEGORIA**: Padrões estranhos dentro de categorias (ex: todas as bebidas de um fornecedor muito caras)

3. **RECOMENDAÇÕES**: Sugira ações concretas para o comprador (verificar com fornecedor, pedir reenvio, etc.)

FORMATO DA RESPOSTA:
Use markdown. Organize em seções claras:
- 🚨 **Alertas Críticos** (erros prováveis de digitação)
- ⚠️ **Preços Acima do Esperado** (>25% acima da média)
- 📉 **Preços Muito Abaixo** (>15% abaixo - pode indicar erro ou produto diferente)
- 💡 **Recomendações**
- 📊 **Resumo Geral** (uma frase sobre a saúde geral dos preços)

Se não houver anomalias, diga claramente que os preços estão dentro do esperado.
Use formato monetário brasileiro (R$ X,XX).
Seja direto e objetivo.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise os seguintes dados de preços e identifique anomalias:\n\n${contextText}` },
        ],
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
    console.error("analyze-precos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
