import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, ...params } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // === WHATSAPP MESSAGE GENERATION ===
    if (type === "whatsapp-message") {
      const { fornecedor_id, cotacao_id, loja_id, items } = params;

      // Get supplier info
      const { data: forn } = await sb.from("fornecedores").select("*").eq("id", fornecedor_id).single();
      // Get store info
      let loja = null;
      if (loja_id) {
        const { data } = await sb.from("lojas").select("*").eq("id", loja_id).single();
        loja = data;
      }

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
- Finalize com "Enviado via CotaFácil"
- Formate para WhatsApp (use *negrito* e _itálico_)
- Seja direto mas cordial`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Configurações." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("AI gateway error");

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === AUTO-CLASSIFY PRODUCTS ===
    if (type === "classify-products") {
      const { products, existing_categories } = params;

      const productNames = (products || []).map((p: any) => p.nome).join("\n");
      const catList = (existing_categories || []).join(", ");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você classifica produtos de supermercado/atacado em categorias. Retorne APENAS o JSON solicitado." },
            { role: "user", content: `Classifique cada produto na categoria mais adequada.

Categorias existentes: ${catList || "Nenhuma"}

Se nenhuma categoria existente for adequada, sugira uma nova categoria (em português, curta e genérica tipo: Bebidas, Limpeza, Higiene, Carnes, Laticínios, Hortifruti, Padaria, Mercearia, Descartáveis, etc).

Produtos:
${productNames}

Retorne um JSON array onde cada item tem: {"nome": "nome do produto", "categoria": "nome da categoria"}
Retorne APENAS o JSON, sem markdown, sem explicação.` }
          ],
          stream: false,
        }),
      });

      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("AI gateway error");

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";
      // Extract JSON from possible markdown code block
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) content = jsonMatch[0];
      
      let classifications;
      try { classifications = JSON.parse(content); } catch { classifications = []; }
      return new Response(JSON.stringify({ classifications }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SUGGEST QUANTITIES ===
    if (type === "suggest-quantities") {
      const { cotacao_id, loja_id } = params;

      // Get current products in quote
      const { data: cps } = await sb.from("cotacao_produtos").select("id, produto_id, quantidade, produtos(nome, embalagem)").eq("cotacao_id", cotacao_id);

      // Get historical data: last 3 finalized quotes for this store
      let historicalContext = "";
      if (loja_id) {
        const { data: pastCots } = await sb.from("cotacoes").select("id, nome, created_at").eq("loja_id", loja_id).eq("status", "finalizada").order("finalizada_at", { ascending: false }).limit(3);

        if (pastCots?.length) {
          const pastIds = pastCots.map(c => c.id);
          const { data: pastCps } = await sb.from("cotacao_produtos").select("cotacao_id, produto_id, quantidade, produtos(nome)").in("cotacao_id", pastIds);

          const histMap: Record<string, number[]> = {};
          (pastCps || []).forEach((cp: any) => {
            const name = cp.produtos?.nome || cp.produto_id;
            if (!histMap[name]) histMap[name] = [];
            if (cp.quantidade) histMap[name].push(cp.quantidade);
          });

          const lines = Object.entries(histMap).map(([name, qtds]) =>
            `- ${name}: quantidades anteriores [${qtds.join(", ")}], média ${(qtds.reduce((a,b) => a+b, 0) / qtds.length).toFixed(1)}`
          );
          historicalContext = `\nHISTÓRICO (últimas ${pastCots.length} cotações):\n${lines.join("\n")}`;
        }
      }

      const currentItems = (cps || []).map((cp: any) =>
        `- ${cp.produtos?.nome || "?"} (${cp.produtos?.embalagem || "un"}) — qtd atual: ${cp.quantidade || 1}`
      ).join("\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você sugere quantidades de compra com base no histórico. Retorne APENAS JSON." },
            { role: "user", content: `Sugira quantidades para cada produto da cotação atual, baseado no histórico de compras.

PRODUTOS ATUAIS:
${currentItems}
${historicalContext}

Para cada produto, retorne a quantidade sugerida e uma justificativa curta.
Retorne JSON array: [{"produto_id": "id", "nome": "nome", "quantidade_sugerida": N, "justificativa": "texto curto"}]

Se não houver histórico, sugira manter a quantidade atual.
Retorne APENAS o JSON, sem markdown.` }
          ],
          tools: [{
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
                        justificativa: { type: "string" }
                      },
                      required: ["nome", "quantidade_sugerida", "justificativa"]
                    }
                  }
                },
                required: ["suggestions"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "suggest_quantities" } },
        }),
      });

      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("AI gateway error");

      const data = await response.json();
      let suggestions = [];
      try {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const args = JSON.parse(toolCall.function.arguments);
          suggestions = args.suggestions || [];
        }
      } catch { /* fallback */ }

      // Map suggestions to cotacao_produto ids (fuzzy name matching)
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

    return new Response(JSON.stringify({ error: "Tipo não reconhecido: " + type }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-automacao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
