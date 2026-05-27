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

    const { cotacao_id, loja_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!cotacao_id) throw new Error("cotacao_id is required");

    // Cross-tenant guard: verify caller owns this cotação.
    const { data: ownCot } = await supabase
      .from("cotacoes").select("id, loja_id").eq("id", cotacao_id).eq("created_by", user.id).maybeSingle();
    if (!ownCot) {
      return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (loja_id && ownCot.loja_id && ownCot.loja_id !== loja_id) {
      return new Response(JSON.stringify({ error: "Loja inválida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch products
    const { data: cotacaoProdutos } = await supabase
      .from("cotacao_produtos")
      .select("id, quantidade, produto_id, produtos(nome, embalagem, categorias(nome))")
      .eq("cotacao_id", cotacao_id);

    // Fetch selected suppliers
    const { data: cotacaoFornecedores } = await supabase
      .from("cotacao_fornecedores")
      .select("fornecedor_id, fornecedores(nome, pedido_minimo, prazo_pagamento, telefone)")
      .eq("cotacao_id", cotacao_id);

    const cpIds = (cotacaoProdutos || []).map((cp: any) => cp.id);
    let precos: any[] = [];
    if (cpIds.length > 0) {
      const { data } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      precos = data || [];
    }

    // Fetch delivery history (pedidos with status recebido/confirmado)
    const { data: pedidosHistorico } = await supabase
      .from("pedidos")
      .select("fornecedor_id, status, total, created_at")
      .in("status", ["recebido", "confirmado", "enviado"])
      .order("created_at", { ascending: false })
      .limit(200);

    // Compute delivery stats per supplier
    const deliveryStats: Record<string, { total: number; received: number; avgTotal: number }> = {};
    (pedidosHistorico || []).forEach((p: any) => {
      if (!deliveryStats[p.fornecedor_id]) {
        deliveryStats[p.fornecedor_id] = { total: 0, received: 0, avgTotal: 0 };
      }
      deliveryStats[p.fornecedor_id].total++;
      if (p.status === "recebido" || p.status === "confirmado") {
        deliveryStats[p.fornecedor_id].received++;
      }
      deliveryStats[p.fornecedor_id].avgTotal += Number(p.total || 0);
    });
    Object.values(deliveryStats).forEach((s: any) => {
      s.avgTotal = s.total > 0 ? s.avgTotal / s.total : 0;
    });

    // Build supplier map
    const fornecedorMap: Record<string, any> = {};
    (cotacaoFornecedores || []).forEach((cf: any) => {
      fornecedorMap[cf.fornecedor_id] = cf.fornecedores;
    });

    // Build context
    const lines: string[] = [];
    lines.push(`COTAÇÃO ATIVA: ${(cotacaoProdutos || []).length} produtos, ${(cotacaoFornecedores || []).length} fornecedores.\n`);

    lines.push("FORNECEDORES PARTICIPANTES:");
    (cotacaoFornecedores || []).forEach((cf: any) => {
      const f = cf.fornecedores;
      const ds = deliveryStats[cf.fornecedor_id];
      const reliability = ds ? `${ds.received}/${ds.total} entregas concluídas` : "sem histórico de entregas";
      lines.push(`- ${f?.nome} | Pedido mínimo: R$${f?.pedido_minimo || 0} | Prazo: ${f?.prazo_pagamento || "não informado"} | Histórico: ${reliability}`);
    });

    lines.push("\nPRODUTOS E PREÇOS:");
    let totalBestPrice = 0;
    const supplierWins: Record<string, { items: number; total: number }> = {};

    (cotacaoProdutos || []).forEach((cp: any) => {
      const prod = cp.produtos;
      const cat = prod?.categorias?.nome || "Sem categoria";
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);

      if (cpPrecos.length > 0) {
        const precosStr = cpPrecos
          .map((p: any) => `${fornecedorMap[p.fornecedor_id]?.nome || "?"}: R$${Number(p.preco).toFixed(2)}`)
          .join(", ");
        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        const winner = cpPrecos.find((p: any) => p.preco === minPrice);
        const winnerName = winner ? (fornecedorMap[winner.fornecedor_id]?.nome || "?") : "?";
        const qty = cp.quantidade || 1;
        totalBestPrice += minPrice * qty;

        if (winner) {
          if (!supplierWins[winner.fornecedor_id]) supplierWins[winner.fornecedor_id] = { items: 0, total: 0 };
          supplierWins[winner.fornecedor_id].items++;
          supplierWins[winner.fornecedor_id].total += minPrice * qty;
        }

        lines.push(`- ${prod?.nome} [${cat}] (emb: ${prod?.embalagem || "-"}, qtd: ${qty})`);
        lines.push(`  Preços: ${precosStr} → Melhor: ${winnerName} R$${minPrice.toFixed(2)}`);
      } else {
        lines.push(`- ${prod?.nome} [${cat}] → sem preço informado`);
      }
    });

    lines.push(`\nDISTRIBUIÇÃO ATUAL (menor preço por item):`);
    Object.entries(supplierWins).forEach(([fid, s]) => {
      const f = fornecedorMap[fid];
      const minOk = !f?.pedido_minimo || s.total >= f.pedido_minimo;
      lines.push(`- ${f?.nome || "?"}: ${s.items} itens, total R$${s.total.toFixed(2)} ${minOk ? "✅ mín. ok" : `❌ falta R$${(f.pedido_minimo - s.total).toFixed(2)} p/ mínimo`}`);
    });
    lines.push(`Total geral (menor preço): R$${totalBestPrice.toFixed(2)}`);

    const contextText = lines.join("\n");

    const systemPrompt = `Você é um especialista em otimização de compras do Compra360. Sua tarefa é sugerir a melhor distribuição de pedidos entre os fornecedores.

CRITÉRIOS DE OTIMIZAÇÃO (em ordem de prioridade):
1. **Pedido Mínimo**: Cada fornecedor deve atingir seu pedido mínimo. Se não atingir, redistribua itens de outros fornecedores (mesmo que custando um pouco mais) para completar o mínimo, OU elimine o fornecedor da rodada.
2. **Melhor Preço**: Priorize o menor preço por item quando possível.
3. **Histórico de Entregas**: Fornecedores mais confiáveis devem ser priorizados em empates.
4. **Diversificação**: Evite concentrar demais em um único fornecedor (risco de falta).

FORMATO DA RESPOSTA (use Markdown):

## 📦 Distribuição Sugerida

Para cada fornecedor que receberá pedido:
### [Nome do Fornecedor]
- **Total estimado**: R$ X.XXX,XX
- **Pedido mínimo**: R$ X.XXX,XX ✅/❌
- **Itens**: X produtos
- Lista dos produtos atribuídos com preço unitário

## 🔄 Redistribuições Recomendadas
Itens que foram movidos do fornecedor mais barato para outro, explicando o motivo (completar pedido mínimo, confiabilidade, etc.)

## 💰 Comparativo
- Total com menor preço puro: R$ X.XXX,XX
- Total com distribuição otimizada: R$ X.XXX,XX
- Diferença: R$ X,XX (+X,X%)
- Benefício: [explicação qualitativa]

## 💡 Recomendações Adicionais
Observações sobre fornecedores, prazos de pagamento, riscos, etc.

Seja objetivo e use formato monetário brasileiro (R$ X,XX). Se todos os fornecedores já atingem o mínimo com menor preço, confirme que a distribuição atual já é ótima.`;

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
          { role: "user", content: `Analise os dados abaixo e sugira a distribuição ótima de pedidos:\n\n${contextText}` },
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
    console.error("suggest-distribuicao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
