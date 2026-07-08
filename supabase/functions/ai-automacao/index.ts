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

    // Cross-tenant guard: ensure caller owns the cotacao/loja/fornecedor it references.
    const _cotId = (params as any)?.cotacao_id;
    const _lojaId = (params as any)?.loja_id;
    const _fornId = (params as any)?.fornecedor_id;
    if (_cotId) {
      const { data: ownCot } = await sb
        .from("cotacoes").select("id").eq("id", _cotId).eq("created_by", user.id).maybeSingle();
      if (!ownCot) {
        return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (_lojaId) {
      const { data: ownLoja } = await sb
        .from("lojas").select("id").eq("id", _lojaId).eq("user_id", user.id).maybeSingle();
      if (!ownLoja) {
        return new Response(JSON.stringify({ error: "Loja não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (_fornId) {
      const { data: ownForn } = await sb
        .from("fornecedores").select("id").eq("id", _fornId).eq("user_id", user.id).maybeSingle();
      if (!ownForn) {
        return new Response(JSON.stringify({ error: "Fornecedor não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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

    const chunkArray = <T,>(items: T[], size: number) => {
      const chunks: T[][] = [];
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
      }
      return chunks;
    };

    const extractJsonArray = (content: string) => {
      const cleaned = content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(/[\u0000-\u001F]+/g, " ")
        .trim();

      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end === -1 || end <= start) return [];

      const candidate = cleaned
        .slice(start, end + 1)
        .replace(/,\s*([}\]])/g, "$1");

      try {
        const parsed = JSON.parse(candidate);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const normalizeClassification = (item: any) => {
      const nome = typeof item?.nome === "string" ? item.nome.trim() : "";
      const categoria = typeof item?.categoria === "string" ? item.categoria.trim() : "";
      if (!nome || !categoria) return null;
      return { nome, categoria };
    };

    // === WHATSAPP MESSAGE GENERATION ===
    if (type === "whatsapp-message") {
      const { fornecedor_id, cotacao_id, loja_id, items } = params;
      const { data: forn } = await sb.from("fornecedores").select("*").eq("id", fornecedor_id).single();
      let loja = null;
      if (loja_id) { const { data } = await sb.from("lojas").select("*").eq("id", loja_id).single(); loja = data; }

      const itemsList = (items || []).map((it: any, i: number) => {
        const fator = Number(it.fator) || 1;
        const fatorLabel = fator > 1 ? ` c/${fator} un` : "";
        const qtyTotal = fator > 1 ? ` (${(Number(it.quantidade) || 1) * fator} un)` : "";
        return `${i+1}. ${it.produto} | Emb: ${it.embalagem}${fatorLabel} | Qtd: ${it.quantidade}${qtyTotal} | R$ ${it.preco} | Subtotal: R$ ${it.total}`;
      }).join("\n");
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
      if (!products?.length) {
        return new Response(JSON.stringify({ classifications: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const catList = (existing_categories || []).join(", ");
      const BATCH_SIZE = 40;
      const allClassifications: Array<{ nome: string; categoria: string }> = [];

      for (const batch of chunkArray(products, BATCH_SIZE)) {
        const productNames = batch
          .map((p: any) => String(p?.nome || "").trim())
          .filter(Boolean)
          .map((name: string) => `- ${name}`)
          .join("\n");

        if (!productNames) continue;

        const result = await callAI(
          [
            {
              role: "system",
              content: "Você classifica produtos de supermercado/atacado em categorias. Sempre responda usando a tool call solicitada.",
            },
            {
              role: "user",
              content: `Classifique cada produto na categoria mais adequada.

Categorias existentes: ${catList || "Nenhuma"}

Se nenhuma categoria existente for adequada, sugira uma nova categoria curta, clara e genérica em português.
Evite categorias duplicadas com variação mínima de nome.
Retorne exatamente 1 classificação para cada produto listado.

Produtos:
${productNames}`,
            },
          ],
          [
            {
              type: "function",
              function: {
                name: "classify_products",
                description: "Classifica produtos em categorias de compra.",
                parameters: {
                  type: "object",
                  properties: {
                    classifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          nome: { type: "string" },
                          categoria: { type: "string" },
                        },
                        required: ["nome", "categoria"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["classifications"],
                  additionalProperties: false,
                },
              },
            },
          ],
          { type: "function", function: { name: "classify_products" } }
        );
        if (result.error) return errorResponse(result.error, result.status);

        let batchClassifications: any[] = [];

        try {
          const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const args = JSON.parse(toolCall.function.arguments);
            batchClassifications = Array.isArray(args.classifications) ? args.classifications : [];
          }
        } catch {
          batchClassifications = [];
        }

        if (!batchClassifications.length) {
          const content = result.data.choices?.[0]?.message?.content || "[]";
          batchClassifications = extractJsonArray(content);
        }

        allClassifications.push(
          ...batchClassifications
            .map(normalizeClassification)
            .filter((item): item is { nome: string; categoria: string } => Boolean(item))
        );
      }

      return new Response(JSON.stringify({ classifications: allClassifications }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SUGGEST QUANTITIES (Phase 3: per-store segmented demand forecasting) ===
    if (type === "suggest-quantities") {
      const { cotacao_id, loja_id } = params;

      const { data: cps } = await sb.from("cotacao_produtos").select("id, produto_id, quantidade, nome, tipo_embalagem, produtos(nome, embalagem)").eq("cotacao_id", cotacao_id);

      // Get store name for context
      let lojaName = "";
      if (loja_id) {
        const { data: loja } = await sb.from("lojas").select("nome").eq("id", loja_id).single();
        lojaName = loja?.nome || "";
      }

      // Get ALL stores for this user to enable cross-store comparison
      const { data: allLojas } = await sb.from("lojas").select("id, nome").eq("user_id", user.id);
      const lojaMap: Record<string, string> = {};
      (allLojas || []).forEach((l: any) => { lojaMap[l.id] = l.nome; });
      const hasMultipleStores = (allLojas || []).length > 1;

      // Helper to build history for a set of quote IDs
      const buildHistory = (pastCps: any[], cotOrder: string[]) => {
        const sorted = [...pastCps].sort((a: any, b: any) => cotOrder.indexOf(a.cotacao_id) - cotOrder.indexOf(b.cotacao_id));
        const tempMap: Record<string, number[]> = {};
        sorted.forEach((cp: any) => {
          const name = cp.nome ?? cp.produtos?.nome ?? cp.produto_id;
          if (!tempMap[name]) tempMap[name] = [];
          if (cp.quantidade) tempMap[name].push(Number(cp.quantidade));
        });
        return tempMap;
      };

      const calcTrend = (qtds: number[]) => {
        if (qtds.length < 3) return "estável";
        const firstHalf = qtds.slice(0, Math.floor(qtds.length / 2));
        const secondHalf = qtds.slice(Math.floor(qtds.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const change = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;
        if (change > 0.15) return "crescente";
        if (change < -0.15) return "diminuindo";
        return "estável";
      };

      // 1) Current store history (last 5 quotes)
      let storeHistContext = "";
      let storeQb = sb.from("cotacoes").select("id, nome, created_at, finalizada_at").neq("status", "ativa").order("finalizada_at", { ascending: false }).limit(5);
      if (loja_id) storeQb = storeQb.eq("loja_id", loja_id);
      const { data: pastCots } = await storeQb;

      if (pastCots?.length) {
        const pastIds = pastCots.map(c => c.id);
        const { data: pastCps } = await sb.from("cotacao_produtos").select("cotacao_id, produto_id, quantidade, nome, tipo_embalagem, produtos(nome)").in("cotacao_id", pastIds);
        const cotOrder = pastCots.map(c => c.id).reverse();
        const tempMap = buildHistory(pastCps || [], cotOrder);

        const lines = Object.entries(tempMap).map(([name, qtds]) => {
          const avg = qtds.reduce((a, b) => a + b, 0) / qtds.length;
          const trend = calcTrend(qtds);
          return `- ${name}: qtds [${qtds.join(", ")}] | média: ${avg.toFixed(1)} | tendência: ${trend}`;
        });
        storeHistContext = `\nHISTÓRICO ${lojaName ? `DA LOJA "${lojaName}"` : ""} (últimas ${pastCots.length} cotações):\n${lines.join("\n")}`;

        // Calculate average interval between quotes (days)
        const dates = pastCots.map(c => new Date(c.finalizada_at || c.created_at).getTime()).sort();
        if (dates.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i-1]) / (1000*60*60*24));
          const avgInterval = intervals.reduce((a,b)=>a+b,0) / intervals.length;
          storeHistContext += `\nFrequência média de compra: a cada ${avgInterval.toFixed(0)} dias`;
        }
      }

      // 2) Cross-store comparison (if multi-store)
      let crossStoreContext = "";
      if (hasMultipleStores && loja_id) {
        const otherLojaIds = (allLojas || []).filter(l => l.id !== loja_id).map(l => l.id);
        if (otherLojaIds.length > 0) {
          let otherQb = sb.from("cotacoes").select("id, loja_id, finalizada_at").neq("status", "ativa").in("loja_id", otherLojaIds).order("finalizada_at", { ascending: false }).limit(10);
          const { data: otherCots } = await otherQb;

          if (otherCots?.length) {
            // Group by store
            const byStore: Record<string, string[]> = {};
            otherCots.forEach((c: any) => {
              if (!byStore[c.loja_id]) byStore[c.loja_id] = [];
              byStore[c.loja_id].push(c.id);
            });

            const storeLines: string[] = [];
            for (const [sId, cotIds] of Object.entries(byStore)) {
              const { data: sCps } = await sb.from("cotacao_produtos").select("cotacao_id, produto_id, quantidade, nome, tipo_embalagem, produtos(nome)").in("cotacao_id", cotIds);
              const tempMap = buildHistory(sCps || [], cotIds.reverse());
              const productLines = Object.entries(tempMap).map(([name, qtds]) => {
                const avg = qtds.reduce((a, b) => a + b, 0) / qtds.length;
                return `  - ${name}: média ${avg.toFixed(1)} (${qtds.length} cotações)`;
              }).slice(0, 15); // top 15 products per store
              storeLines.push(`📍 ${lojaMap[sId] || sId}:\n${productLines.join("\n")}`);
            }
            if (storeLines.length > 0) {
              crossStoreContext = `\n\nCOMPARATIVO ENTRE LOJAS (outras lojas do mesmo grupo):\n${storeLines.join("\n\n")}`;
            }
          }
        }
      }

      const currentItems = (cps || []).map((cp: any) =>
        `- ${cp.nome ?? cp.produtos?.nome ?? "?"} (${cp.tipo_embalagem ?? cp.produtos?.embalagem ?? "un"}) — qtd atual: ${cp.quantidade || 1}`
      ).join("\n");

      const multiStoreInstruction = hasMultipleStores ? `
- Compare o consumo desta loja com as demais. Se outra loja consome significativamente mais ou menos, mencione na justificativa.
- Na justificativa, indique se a sugestão considera sazonalidade, tendência ou padrão comparativo entre lojas.
- Adicione o campo "comparativo_lojas" com uma frase curta comparando (ex: "Consome 30% mais que Loja B").` : "";

      const result = await callAI(
        [
          { role: "system", content: "Você é um analista de demanda que sugere quantidades de compra baseado em histórico segmentado por loja. Retorne APENAS JSON via tool call." },
          { role: "user", content: `Sugira quantidades para cada produto da cotação atual${lojaName ? ` da loja "${lojaName}"` : ""}, baseado no histórico de compras.

PRODUTOS ATUAIS:
${currentItems}
${storeHistContext}
${crossStoreContext}

REGRAS:
- Se a tendência for crescente, sugira quantidade ligeiramente acima da média.
- Se estável, sugira a média arredondada.
- Se diminuindo, sugira quantidade ligeiramente abaixo da média.
- Se não houver histórico, manter a quantidade atual e tendência "sem_historico".
- Considere a frequência de compra para ajustar (compras mais frequentes = menores quantidades).${multiStoreInstruction}` }
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
                      tendencia: { type: "string", enum: ["crescente", "estável", "diminuindo", "sem_historico"] },
                      comparativo_lojas: { type: "string", description: "Brief cross-store comparison if applicable" }
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
          const cpName = ((cp.nome ?? cp.produtos?.nome) || "").toLowerCase().trim();
          return cpName === sName || cpName.includes(sName) || sName.includes(cpName) || cp.produto_id === s.produto_id;
        });
        return { ...s, cotacao_produto_id: match?.id || null };
      });

      return new Response(JSON.stringify({ suggestions: mapped, loja_nome: lojaName, multi_store: hasMultipleStores }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // === SUGGEST FATOR_EMBALAGEM FOR PRODUCTS ===
    if (type === "suggest-fator") {
      const { products } = params; // Array of { id, nome, embalagem }
      if (!products?.length) return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Batch in groups of 50 to avoid overly long prompts
      const BATCH = 50;
      const allSuggestions: any[] = [];

      for (let i = 0; i < products.length; i += BATCH) {
        const batch = products.slice(i, i + BATCH);
        const productsList = batch.map((p: any) => `- ID: ${p.id} | Nome: ${p.nome} | Embalagem: ${p.embalagem || "UNI"}`).join("\n");

        const result = await callAI(
          [
            { role: "system", content: "Você é um especialista em embalagens de produtos de supermercado/atacado brasileiro. Sua tarefa é determinar o fator de conversão (quantas unidades individuais vêm dentro de cada embalagem) para cada produto." },
            { role: "user", content: `Para cada produto abaixo, determine o fator de embalagem (quantas unidades individuais estão dentro de cada embalagem de venda).

REGRAS:
- O fator indica quantas UNIDADES INDIVIDUAIS vêm em cada embalagem
- Exemplos: "Coca-Cola 350ml - CX c/12" → fator 12 (12 latas na caixa)
- "Arroz 5kg - FD c/6" → fator 6 (6 pacotes no fardo)
- "Sabonete Dove - DZ" → fator 12 (dúzia = 12)
- Se o nome do produto já indica a quantidade (ex: "c/24", "c/6", "12 unid", "x12"), USE esse número
- Se a embalagem é UNI, KG, LT, PCT sem indicação de quantidade, fator = 1
- Se a embalagem é DZ ou ½DZ, fator = 12 ou 6 respectivamente
- Se a embalagem é CX ou FD e não há indicação de quantidade no nome, tente inferir pelo tipo de produto ou use um padrão razoável (CX geralmente 12, FD geralmente 6)
- Na dúvida, prefira fator 1 (é mais seguro subestimar)

PRODUTOS:
${productsList}

Retorne via tool call.` }
          ],
          [{
            type: "function",
            function: {
              name: "suggest_fatores",
              description: "Return suggested fator_embalagem for each product",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Product ID" },
                        fator: { type: "number", description: "Suggested fator_embalagem" },
                        justificativa: { type: "string", description: "Brief explanation" }
                      },
                      required: ["id", "fator"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["suggestions"],
                additionalProperties: false
              }
            }
          }],
          { type: "function", function: { name: "suggest_fatores" } }
        );
        if (result.error) return errorResponse(result.error, result.status);

        try {
          const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const args = JSON.parse(toolCall.function.arguments);
            allSuggestions.push(...(args.suggestions || []));
          }
        } catch { /* continue */ }
      }

      return new Response(JSON.stringify({ suggestions: allSuggestions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === NEGOTIATION ARGUMENTS ===
    if (type === "negotiate") {
      const { cotacao_id, fornecedor_id, loja_id } = params;

      // Get current cotacao products + prices
      const { data: cps } = await sb.from("cotacao_produtos").select("*, produtos(nome, embalagem, categorias(nome))").eq("cotacao_id", cotacao_id);
      if (!cps?.length) return errorResponse("Sem produtos na cotação", 400);

      const cpIds = cps.map((cp: any) => cp.id);
      const { data: allPrecos } = await sb.from("precos").select("*").in("cotacao_produto_id", cpIds);

      // Get supplier info
      const { data: forn } = await sb.from("fornecedores").select("*").eq("id", fornecedor_id).single();
      if (!forn) return errorResponse("Fornecedor não encontrado", 404);

      // Get all suppliers in this cotacao for comparison
      const { data: cotForn } = await sb.from("cotacao_fornecedores").select("fornecedor_id").eq("cotacao_id", cotacao_id);
      const fornIds = (cotForn || []).map((cf: any) => cf.fornecedor_id);
      const { data: allForns } = await sb.from("fornecedores").select("id, nome").in("id", fornIds);
      const fornMap = Object.fromEntries((allForns || []).map((f: any) => [f.id, f.nome]));

      // Build per-product price comparison
      const comparisons: any[] = [];
      for (const cp of cps) {
        const cpPrecos = (allPrecos || []).filter((p: any) => p.cotacao_produto_id === cp.id && p.preco != null && p.preco > 0);
        if (!cpPrecos.length) continue;

        const myPrice = cpPrecos.find((p: any) => p.fornecedor_id === fornecedor_id);
        if (!myPrice) continue;

        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        const avgPrice = cpPrecos.reduce((s: number, p: any) => s + p.preco, 0) / cpPrecos.length;
        const winner = cpPrecos.find((p: any) => p.preco === minPrice);

        comparisons.push({
          produto: (cp.produtos as any)?.nome || "?",
          categoria: (cp.produtos as any)?.categorias?.nome || null,
          preco_fornecedor: myPrice.preco,
          melhor_preco: minPrice,
          media_preco: Math.round(avgPrice * 100) / 100,
          diferenca_pct: Math.round(((myPrice.preco - minPrice) / minPrice) * 100),
          vencedor: fornMap[winner?.fornecedor_id] || "outro",
          quantidade: cp.quantidade || 1,
          fator: cp.fator_embalagem || 1,
        });
      }

      // Get historical prices (last 5 cotacoes)
      let histQuery = sb.from("cotacoes").select("id, created_at").neq("id", cotacao_id).in("status", ["finalizada"]).order("created_at", { ascending: false }).limit(5);
      if (loja_id) histQuery = histQuery.eq("loja_id", loja_id);
      const { data: pastCots } = await histQuery;

      let histContext = "";
      if (pastCots?.length) {
        const pastCotIds = pastCots.map((c: any) => c.id);
        const { data: pastCps } = await sb.from("cotacao_produtos").select("id, produto_id, cotacao_id").in("cotacao_id", pastCotIds);
        if (pastCps?.length) {
          const pastCpIds = pastCps.map((cp: any) => cp.id);
          const { data: pastPrecos } = await sb.from("precos").select("cotacao_produto_id, fornecedor_id, preco").in("cotacao_produto_id", pastCpIds).eq("fornecedor_id", fornecedor_id);

          if (pastPrecos?.length) {
            // Map past prices to product names
            const pastPricesByProduct: Record<string, number[]> = {};
            for (const pp of pastPrecos) {
              const pastCp = pastCps.find((cp: any) => cp.id === pp.cotacao_produto_id);
              if (!pastCp) continue;
              const currentCp = cps.find((cp: any) => (cp.produtos as any)?.id === pastCp.produto_id || cp.produto_id === pastCp.produto_id);
              const nome = currentCp ? (currentCp.produtos as any)?.nome : null;
              if (!nome) continue;
              if (!pastPricesByProduct[nome]) pastPricesByProduct[nome] = [];
              pastPricesByProduct[nome].push(pp.preco);
            }

            const trends: string[] = [];
            for (const [nome, prices] of Object.entries(pastPricesByProduct)) {
              const current = comparisons.find((c: any) => c.produto === nome);
              if (!current) continue;
              const avgHist = prices.reduce((a, b) => a + b, 0) / prices.length;
              const change = ((current.preco_fornecedor - avgHist) / avgHist) * 100;
              if (Math.abs(change) > 5) {
                trends.push(`${nome}: preço atual R$${current.preco_fornecedor} vs média histórica R$${avgHist.toFixed(2)} (${change > 0 ? "+" : ""}${change.toFixed(0)}%)`);
              }
            }
            if (trends.length) histContext = `\n\nTENDÊNCIAS DE PREÇO (${forn.nome}, últimas ${pastCots.length} cotações):\n${trends.join("\n")}`;
          }
        }
      }

      // Items where this supplier loses
      const losses = comparisons.filter((c: any) => c.diferenca_pct > 0).sort((a: any, b: any) => b.diferenca_pct - a.diferenca_pct);
      const wins = comparisons.filter((c: any) => c.diferenca_pct === 0);
      const totalFornecedor = comparisons.reduce((s: number, c: any) => s + c.preco_fornecedor * c.quantidade * c.fator, 0);
      const totalMelhor = comparisons.reduce((s: number, c: any) => s + c.melhor_preco * c.quantidade * c.fator, 0);

      const prompt = `Você é um especialista em negociação de compras para varejo. Gere argumentos de negociação concretos para usar com o fornecedor "${forn.nome}".

DADOS DA COTAÇÃO ATUAL:
- Total com ${forn.nome}: R$${totalFornecedor.toFixed(2)}
- Total se comprasse tudo pelo melhor preço: R$${totalMelhor.toFixed(2)}
- Diferença: R$${(totalFornecedor - totalMelhor).toFixed(2)}
- Itens onde ${forn.nome} vence: ${wins.length} de ${comparisons.length}
- Itens onde ${forn.nome} perde: ${losses.length}

ITENS ONDE ${forn.nome.toUpperCase()} ESTÁ MAIS CARO (top 10):
${losses.slice(0, 10).map((l: any) => `- ${l.produto}: R$${l.preco_fornecedor} vs melhor R$${l.melhor_preco} (+${l.diferenca_pct}%, vencedor: ${l.vencedor})`).join("\n")}

ITENS ONDE ${forn.nome.toUpperCase()} VENCE:
${wins.slice(0, 5).map((w: any) => `- ${w.produto}: R$${w.preco_fornecedor}`).join("\n")}${histContext}

INSTRUÇÕES:
1. Gere 3-5 argumentos de negociação específicos e acionáveis
2. Use dados reais dos comparativos (nomes de produtos, percentuais, valores)
3. Sugira produtos-chave onde pedir desconto teria maior impacto (maior volume × diferença)
4. Se houver tendências de aumento, use como argumento
5. Mantenha tom profissional e colaborativo
6. Formate em Markdown com seções claras
7. Inclua uma sugestão de meta de desconto realista (% geral)
8. Termine com um resumo da mensagem ideal para enviar ao fornecedor`;

      const result = await callAI([{ role: "user", content: prompt }]);
      if (result.error) return errorResponse(result.error, result.status);

      const text = result.data.choices?.[0]?.message?.content || "Sem resultado";

      return new Response(JSON.stringify({
        text,
        fornecedor_nome: forn.nome,
        total_fornecedor: totalFornecedor,
        total_melhor: totalMelhor,
        wins: wins.length,
        losses: losses.length,
        total_items: comparisons.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Tipo não reconhecido: " + type }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-automacao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
