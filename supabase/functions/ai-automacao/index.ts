import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { type, ...params } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Helper: call AI gateway
    const callAI = async (messages: any[], tools?: any[], tool_choice?: any) => {
      const body: any = { model: "google/gemini-3-flash-preview", messages, stream: false };
      if (tools) { body.tools = tools; body.tool_choice = tool_choice; }
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 429) return { error: "Limite de requisições excedido. Tente novamente em alguns segundos.", status: 429 };
      if (response.status === 402) return { error: "Créditos esgotados. Adicione fundos em Configurações.", status: 402 };
      if (!response.ok) throw new Error("AI gateway error");
      return { data: await response.json(), status: 200 };
    };

    const errorResponse = (msg: string, status: number) =>
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // === WHATSAPP MESSAGE GENERATION ===
    if (type === "whatsapp-message") {
      const { fornecedor_id, cotacao_id, loja_id, items } = params;
      const { data: forn } = await sb.from("fornecedores").select("*").eq("id", fornecedor_id).single();
      let loja = null;
      if (loja_id) { const { data } = await sb.from("lojas").select("*").eq("id", loja_id).single(); loja = data; }

      const itemsList = (items || []).map((it: any, i: number) =>
        `${i+1}. ${it.produto} | Emb: ${it.embalagem} | Qtd: ${it.quantidade} | R$ ${it.preco} | Subtotal: R$ ${it.total}`
      ).join("\n");
      const totalGeral = Number((items || []).reduce((s: number, it: any) => s + (Number(it.total) || 0), 0)) || 0;

      const prompt = `Você é o assistente Compra360. Gere uma mensagem de WhatsApp profissional e amigável para enviar um pedido de compra ao fornecedor.

DADOS DO FORNECEDOR:
- Nome: ${forn?.nome || "Desconhecido"}
- Representante: ${forn?.representante || "N/A"}
- Prazo pagamento: ${forn?.prazo_pagamento || "N/A"}
- Pedido mínimo: R$ ${forn?.pedido_minimo || 0}

${loja ? `DADOS DA LOJA:
- Nome: ${loja.nome}
- Razão Social: ${loja.razao_social || "N/A"}
- CNPJ: ${loja.cnpj || "N/A"}
- Endereço: ${loja.endereco || "N/A"}` : ""}

ITENS DO PEDIDO:
${itemsList}

TOTAL GERAL: R$ ${totalGeral.toFixed(2)}

Regras:
- Use emojis moderadamente
- Inclua saudação personalizada usando o nome do representante se disponível
- Liste todos os itens de forma organizada
- Inclua dados de faturamento da loja
- Finalize com "Enviado via Compra360"
- Formate para WhatsApp (use *negrito* e _itálico_)
- Seja direto mas cordial`;

      const result = await callAI([{ role: "user", content: prompt }]);
      if (result.error) return errorResponse(result.error, result.status);
      const message = result.data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === AUTO-CLASSIFY PRODUCTS ===
    if (type === "classify-products") {
      const { products, existing_categories } = params;
      const productNames = (products || []).map((p: any) => p.nome).join("\n");
      const catList = (existing_categories || []).join(", ");

      const result = await callAI([
        { role: "system", content: "Você classifica produtos de supermercado/atacado em categorias. Retorne APENAS o JSON solicitado." },
        { role: "user", content: `Classifique cada produto na categoria mais adequada.

Categorias existentes: ${catList || "Nenhuma"}

Se nenhuma categoria existente for adequada, sugira uma nova categoria (em português, curta e genérica tipo: Bebidas, Limpeza, Higiene, Carnes, Laticínios, Hortifruti, Padaria, Mercearia, Descartáveis, etc).

Produtos:
${productNames}

Retorne um JSON array onde cada item tem: {"nome": "nome do produto", "categoria": "nome da categoria"}
Retorne APENAS o JSON, sem markdown, sem explicação.` }
      ]);
      if (result.error) return errorResponse(result.error, result.status);

      let content = result.data.choices?.[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) content = jsonMatch[0];
      let classifications;
      try { classifications = JSON.parse(content); } catch { classifications = []; }
      return new Response(JSON.stringify({ classifications }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SUGGEST QUANTITIES (improved with 5-quote history + trend) ===
    if (type === "suggest-quantities") {
      const { cotacao_id, loja_id } = params;

      const { data: cps } = await sb.from("cotacao_produtos").select("id, produto_id, quantidade, produtos(nome, embalagem)").eq("cotacao_id", cotacao_id);

      // Get last 5 finalized quotes for this store
      let historicalContext = "";
      if (loja_id || true) {
        let qb = sb.from("cotacoes").select("id, nome, created_at").neq("status", "ativa").order("finalizada_at", { ascending: false }).limit(5);
        if (loja_id) qb = qb.eq("loja_id", loja_id);
        const { data: pastCots } = await qb;

        if (pastCots?.length) {
          const pastIds = pastCots.map(c => c.id);
          const { data: pastCps } = await sb.from("cotacao_produtos").select("cotacao_id, produto_id, quantidade, produtos(nome)").in("cotacao_id", pastIds);

          // Build per-product history ordered by quote date (oldest first)
          const histMap: Record<string, { qtds: number[]; name: string }> = {};
          const cotOrder = pastCots.map(c => c.id).reverse(); // oldest first

          (pastCps || []).forEach((cp: any) => {
            const name = cp.produtos?.nome || cp.produto_id;
            if (!histMap[name]) histMap[name] = { qtds: [], name };
            if (cp.quantidade) {
              const idx = cotOrder.indexOf(cp.cotacao_id);
              // Store with index for ordering
              histMap[name].qtds.push(cp.quantidade);
            }
          });

          // Reorder by quote chronology
          const orderedHist: Record<string, { qtds: number[]; name: string }> = {};
          (pastCps || []).sort((a: any, b: any) => {
            return cotOrder.indexOf(a.cotacao_id) - cotOrder.indexOf(b.cotacao_id);
          });
          const tempMap: Record<string, number[]> = {};
          (pastCps || []).forEach((cp: any) => {
            const name = cp.produtos?.nome || cp.produto_id;
            if (!tempMap[name]) tempMap[name] = [];
            if (cp.quantidade) tempMap[name].push(cp.quantidade);
          });

          const lines = Object.entries(tempMap).map(([name, qtds]) => {
            const avg = qtds.reduce((a, b) => a + b, 0) / qtds.length;
            // Calculate trend
            let trend = "estável";
            if (qtds.length >= 3) {
              const firstHalf = qtds.slice(0, Math.floor(qtds.length / 2));
              const secondHalf = qtds.slice(Math.floor(qtds.length / 2));
              const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
              const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
              const change = (avgSecond - avgFirst) / avgFirst;
              if (change > 0.15) trend = "crescente";
              else if (change < -0.15) trend = "diminuindo";
            }
            return `- ${name}: comprado ${qtds.join(", ")} nas últimas ${qtds.length} cotações | média: ${avg.toFixed(1)} | tendência: ${trend}`;
          });
          historicalContext = `\nHISTÓRICO (últimas ${pastCots.length} cotações):\n${lines.join("\n")}`;
        }
      }

      const currentItems = (cps || []).map((cp: any) =>
        `- ${cp.produtos?.nome || "?"} (${cp.produtos?.embalagem || "un"}) — qtd atual: ${cp.quantidade || 1}`
      ).join("\n");

      const result = await callAI(
        [
          { role: "system", content: "Você sugere quantidades de compra com base no histórico. Retorne APENAS JSON via tool call." },
          { role: "user", content: `Sugira quantidades para cada produto da cotação atual, baseado no histórico de compras.

PRODUTOS ATUAIS:
${currentItems}
${historicalContext}

Para cada produto, retorne a quantidade sugerida, uma justificativa curta e a tendência (crescente, estável ou diminuindo).
Se a tendência for crescente, sugira quantidade ligeiramente acima da média.
Se estável, sugira a média arredondada.
Se diminuindo, sugira quantidade ligeiramente abaixo da média.
Se não houver histórico, manter a quantidade atual e tendência "sem_historico".` }
        ],
        [{
          type: "function",
          function: {
            name: "suggest_quantities",
            description: "Suggest quantities for products",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      produto_id: { type: "string" },
                      nome: { type: "string" },
                      quantidade_sugerida: { type: "number" },
                      justificativa: { type: "string" },
                      tendencia: { type: "string", enum: ["crescente", "estável", "diminuindo", "sem_historico"] }
                    },
                    required: ["nome", "quantidade_sugerida", "justificativa", "tendencia"]
                  }
                }
              },
              required: ["suggestions"]
            }
          }
        }],
        { type: "function", function: { name: "suggest_quantities" } }
      );
      if (result.error) return errorResponse(result.error, result.status);

      let suggestions: any[] = [];
      try {
        const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const args = JSON.parse(toolCall.function.arguments);
          suggestions = args.suggestions || [];
        }
      } catch { /* fallback */ }

      // Map suggestions to cotacao_produto ids
      const mapped = suggestions.map((s: any) => {
        const sName = (s.nome || "").toLowerCase().trim();
        const match = (cps || []).find((cp: any) => {
          const cpName = (cp.produtos?.nome || "").toLowerCase().trim();
          return cpName === sName || cpName.includes(sName) || sName.includes(cpName) || cp.produto_id === s.produto_id;
        });
        return { ...s, cotacao_produto_id: match?.id || null };
      });

      return new Response(JSON.stringify({ suggestions: mapped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SUGGEST SUPPLIERS PER PRODUCT ===
    if (type === "suggest-fornecedores") {
      const { cotacao_id, loja_id } = params;

      // Get current products
      const { data: cps } = await sb.from("cotacao_produtos").select("id, produto_id, produtos(nome)").eq("cotacao_id", cotacao_id);
      if (!cps?.length) return new Response(JSON.stringify({ text: "Nenhum produto na cotação.", has_history: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Get last 5 finalized quotes
      let qb = sb.from("cotacoes").select("id").neq("status", "ativa").order("finalizada_at", { ascending: false }).limit(5);
      if (loja_id) qb = qb.eq("loja_id", loja_id);
      const { data: pastCots } = await qb;

      if (!pastCots || pastCots.length < 2) {
        return new Response(JSON.stringify({ text: "", has_history: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const pastIds = pastCots.map(c => c.id);
      const produtoIds = cps.map(cp => cp.produto_id);

      // Get past cotacao_produtos for these products
      const { data: pastCps } = await sb.from("cotacao_produtos").select("id, produto_id, cotacao_id, produtos(nome)").in("cotacao_id", pastIds).in("produto_id", produtoIds);
      if (!pastCps?.length) {
        return new Response(JSON.stringify({ text: "", has_history: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get prices for those
      const pastCpIds = pastCps.map(cp => cp.id);
      const { data: pastPrecos } = await sb.from("precos").select("cotacao_produto_id, fornecedor_id, preco").in("cotacao_produto_id", pastCpIds).not("preco", "is", null).gt("preco", 0);
      if (!pastPrecos?.length) {
        return new Response(JSON.stringify({ text: "", has_history: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get supplier names
      const fornIds = [...new Set(pastPrecos.map(p => p.fornecedor_id))];
      const { data: forns } = await sb.from("fornecedores").select("id, nome").in("id", fornIds);
      const fornNameMap: Record<string, string> = {};
      (forns || []).forEach((f: any) => { fornNameMap[f.id] = f.nome; });

      // Build per-product supplier stats
      // For each product: for each quote, find the min price → count wins per supplier
      const productStats: Record<string, { name: string; suppliers: Record<string, { wins: number; prices: number[]; name: string }> }> = {};

      for (const cp of cps) {
        const pName = (cp as any).produtos?.nome || "?";
        productStats[cp.produto_id] = { name: pName, suppliers: {} };

        // Group past CPs by cotacao for this product
        const productPastCps = pastCps.filter(pcp => pcp.produto_id === cp.produto_id);
        const byCotacao: Record<string, typeof pastPrecos> = {};
        for (const pcp of productPastCps) {
          const prices = pastPrecos.filter(p => p.cotacao_produto_id === pcp.id);
          if (prices.length) byCotacao[pcp.cotacao_id] = prices;
        }

        for (const [, prices] of Object.entries(byCotacao)) {
          const minPrice = Math.min(...prices.map(p => Number(p.preco)));
          for (const p of prices) {
            const fId = p.fornecedor_id;
            if (!productStats[cp.produto_id].suppliers[fId]) {
              productStats[cp.produto_id].suppliers[fId] = { wins: 0, prices: [], name: fornNameMap[fId] || fId };
            }
            productStats[cp.produto_id].suppliers[fId].prices.push(Number(p.preco));
            if (Number(p.preco) === minPrice) {
              productStats[cp.produto_id].suppliers[fId].wins++;
            }
          }
        }
      }

      // Build prompt
      const statsText = Object.entries(productStats).map(([, ps]) => {
        const suppLines = Object.values(ps.suppliers)
          .sort((a, b) => b.wins - a.wins)
          .map(s => `  - ${s.name}: menor preço ${s.wins} vezes | preço médio R$${(s.prices.reduce((a,b)=>a+b,0)/s.prices.length).toFixed(2)}`)
          .join("\n");
        return `📦 ${ps.name}\n${suppLines}`;
      }).join("\n\n");

      const prompt = `Você é o assistente Compra360. Gere um relatório de FORNECEDORES RECOMENDADOS por produto.

DADOS HISTÓRICOS (últimas ${pastCots.length} cotações):
${statsText}

Regras:
- Para cada produto, rankeie os fornecedores com 🥇 (melhor), 🥈 (segundo), etc.
- Destaque quantas vezes cada fornecedor teve o menor preço
- Inclua o preço médio histórico
- Se um fornecedor nunca teve o menor preço, use ⚠️
- Use formatação Markdown
- Comece com "# 🎯 FORNECEDORES RECOMENDADOS POR PRODUTO"
- Ao final, adicione uma seção "## 📊 Resumo" indicando os fornecedores mais competitivos no geral
- Seja objetivo e direto`;

      const aiResult = await callAI([{ role: "user", content: prompt }]);
      if (aiResult.error) return errorResponse(aiResult.error, aiResult.status);

      const text = aiResult.data.choices?.[0]?.message?.content || "";

      // Extract recommended suppliers (those with 🥇 in at least 2 products)
      const winsBySupplier: Record<string, number> = {};
      for (const ps of Object.values(productStats)) {
        let maxWins = 0;
        let winnerId = "";
        for (const [fId, s] of Object.entries(ps.suppliers)) {
          if (s.wins > maxWins) { maxWins = s.wins; winnerId = fId; }
        }
        if (winnerId && maxWins > 0) {
          winsBySupplier[winnerId] = (winsBySupplier[winnerId] || 0) + 1;
        }
      }
      const recommendedIds = Object.entries(winsBySupplier).filter(([, count]) => count >= 2).map(([id]) => id);

      return new Response(JSON.stringify({ text, has_history: true, recommended_supplier_ids: recommendedIds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Tipo não reconhecido: " + type }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-automacao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
