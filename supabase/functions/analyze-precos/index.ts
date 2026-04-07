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

    const { cotacao_id } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!cotacao_id) throw new Error("cotacao_id is required");

    // Fetch products with prices
    const { data: cotacaoProdutos } = await supabase
      .from("cotacao_produtos")
      .select("id, quantidade, produto_id, produtos(nome, embalagem, categorias(nome))")
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

    // Fetch historical prices (last 3 finalized cotações)
    const { data: lastFinalized } = await supabase
      .from("cotacoes")
      .select("id")
      .eq("status", "finalizada")
      .order("finalizada_at", { ascending: false })
      .limit(3);

    // Build historical averages per produto_id and best supplier per product
    const historicalAvgs: Record<string, { avg: number; count: number; bestSupplier: string | null; bestPrice: number | null }> = {};
    const historicalDetails: string[] = [];

    if (lastFinalized && lastFinalized.length > 0) {
      const histCotIds = lastFinalized.map((c: any) => c.id);
      const { data: histCps } = await supabase
        .from("cotacao_produtos")
        .select("id, produto_id")
        .in("cotacao_id", histCotIds);

      if (histCps && histCps.length > 0) {
        const histCpIds = histCps.map((cp: any) => cp.id);
        const { data: histPrecos } = await supabase
          .from("precos")
          .select("cotacao_produto_id, fornecedor_id, preco")
          .in("cotacao_produto_id", histCpIds);

        if (histPrecos) {
          // Group by produto_id
          const prodPrices: Record<string, { total: number; count: number; supplierPrices: Record<string, number[]> }> = {};
          for (const hp of histPrecos) {
            if (hp.preco == null || hp.preco <= 0) continue;
            const cp = histCps.find((c: any) => c.id === hp.cotacao_produto_id);
            if (!cp) continue;
            const pid = cp.produto_id;
            if (!prodPrices[pid]) prodPrices[pid] = { total: 0, count: 0, supplierPrices: {} };
            prodPrices[pid].total += Number(hp.preco);
            prodPrices[pid].count += 1;
            if (!prodPrices[pid].supplierPrices[hp.fornecedor_id]) prodPrices[pid].supplierPrices[hp.fornecedor_id] = [];
            prodPrices[pid].supplierPrices[hp.fornecedor_id].push(Number(hp.preco));
          }

          // Build supplier map for names
          const fornecedorMap: Record<string, string> = {};
          (cotacaoFornecedores || []).forEach((cf: any) => {
            fornecedorMap[cf.fornecedor_id] = cf.fornecedores?.nome || "Desconhecido";
          });

          for (const [pid, data] of Object.entries(prodPrices)) {
            const avg = data.total / data.count;
            // Find supplier with lowest avg price
            let bestSupplierId: string | null = null;
            let bestAvg = Infinity;
            for (const [sid, prices] of Object.entries(data.supplierPrices)) {
              const sAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
              if (sAvg < bestAvg) { bestAvg = sAvg; bestSupplierId = sid; }
            }
            historicalAvgs[pid] = {
              avg,
              count: data.count,
              bestSupplier: bestSupplierId ? (fornecedorMap[bestSupplierId] || bestSupplierId) : null,
              bestPrice: bestAvg < Infinity ? bestAvg : null,
            };
          }
        }
      }
    }

    // Build supplier map
    const fornecedorMap: Record<string, string> = {};
    (cotacaoFornecedores || []).forEach((cf: any) => {
      fornecedorMap[cf.fornecedor_id] = cf.fornecedores?.nome || "Desconhecido";
    });

    // Count suppliers who responded
    const respondedSuppliers = new Set(precos.filter((p: any) => p.preco > 0).map((p: any) => p.fornecedor_id));
    const totalSuppliers = (cotacaoFornecedores || []).length;

    // Build analysis data
    const lines: string[] = [];
    lines.push(`Cotação com ${(cotacaoProdutos || []).length} produtos e ${totalSuppliers} fornecedores (${respondedSuppliers.size} responderam, ${totalSuppliers - respondedSuppliers.size} pendentes).\n`);

    // Products without any price
    const semPreco: string[] = [];

    lines.push("PRODUTOS E PREÇOS ATUAIS:");
    (cotacaoProdutos || []).forEach((cp: any) => {
      const prod = cp.produtos;
      const cat = prod?.categorias?.nome || "Sem categoria";
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
      const precosStr = cpPrecos
        .map((p: any) => `${fornecedorMap[p.fornecedor_id] || "?"}: R$${Number(p.preco).toFixed(2)}`)
        .join(", ");

      if (cpPrecos.length > 0) {
        const vals = cpPrecos.map((p: any) => Number(p.preco));
        const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const spread = avg > 0 ? (((max - min) / avg) * 100).toFixed(1) : "0";
        lines.push(`- ${prod?.nome} [${cat}] (emb: ${prod?.embalagem || "-"}, qtd: ${cp.quantidade || 1})`);
        lines.push(`  Preços: ${precosStr}`);
        lines.push(`  Média: R$${avg.toFixed(2)} | Min: R$${min.toFixed(2)} | Max: R$${max.toFixed(2)} | Spread: ${spread}%`);

        // Historical comparison
        const hist = historicalAvgs[cp.produto_id];
        if (hist) {
          const diffPct = ((avg - hist.avg) / hist.avg * 100).toFixed(1);
          lines.push(`  Histórico (últimas 3): Média R$${hist.avg.toFixed(2)} | Variação: ${Number(diffPct) > 0 ? "+" : ""}${diffPct}%${hist.bestSupplier ? ` | Fornecedor mais competitivo: ${hist.bestSupplier} (R$${hist.bestPrice?.toFixed(2)})` : ""}`);
        }
      } else {
        lines.push(`- ${prod?.nome} [${cat}] → sem preço informado`);
        semPreco.push(prod?.nome || "?");
      }
    });

    if (semPreco.length > 0) {
      lines.push(`\nPRODUTOS SEM NENHUM PREÇO: ${semPreco.join(", ")}`);
    }

    const contextText = lines.join("\n");

    const systemPrompt = `Você é um analista especialista em compras e detecção de preços suspeitos para o Compra360.

Analise os preços da cotação ativa comparando com dados históricos e identifique:

1. **PREÇOS SUSPEITOS VS HISTÓRICO**: Compare cada preço com a média histórica das últimas 3 cotações. Destaque variações significativas (ex: "Arroz Tipo 1 está 18% acima da média histórica com o Fornecedor X").

2. **PREÇOS SUSPEITOS VS CONCORRÊNCIA**: Valores muito acima ou muito abaixo dos demais fornecedores para o mesmo item. Considere:
   - Possíveis erros de digitação (ex: R$1,50 vs R$15,00)
   - Unidades diferentes (preço por kg vs por unidade)
   - Preços muito abaixo do histórico: "Detergente com preço 60% abaixo do histórico — possível erro de digitação"

3. **RECOMENDAÇÕES BASEADAS NO HISTÓRICO**: Sugira fornecedores mais competitivos baseado no desempenho histórico.

FORMATO DA RESPOSTA (use esta estrutura exata):

📊 **Resumo Geral**
(Progresso da cotação: X de Y fornecedores responderam, total de itens, itens sem preço)

🏆 **Melhores Escolhas por Fornecedor**
(Qual fornecedor tem mais itens com menor preço, recomendações de alocação)

⚠️ **Alertas**
(Anomalias, possíveis erros de digitação, preços muito diferentes do histórico)

💡 **Recomendações Finais**
(Ações concretas: verificar com fornecedor, pedir reenvio, considerar fornecedor histórico, etc.)

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
