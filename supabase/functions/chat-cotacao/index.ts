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
      // Cross-tenant guard: verify caller owns this cotação.
      const { data: ownCot } = await supabase
        .from("cotacoes").select("id").eq("id", cotacao_id).eq("created_by", user.id).maybeSingle();
      if (!ownCot) {
        return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fetch products with prices
      const { data: cotacaoProdutos } = await supabase
        .from("cotacao_produtos")
        .select("id, quantidade, nome, tipo_embalagem, produtos(nome, embalagem, categorias(nome))")
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
        const nome = cp.nome ?? prod?.nome ?? "?";
        const embalagem = cp.tipo_embalagem ?? prod?.embalagem ?? "un";
        const cat = prod?.categorias?.nome || "Sem categoria";
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
        const precosStr = cpPrecos
          .map((p: any) => `${fornecedorMap[p.fornecedor_id] || "?"}: R$${Number(p.preco).toFixed(2)}`)
          .join(", ");
        lines.push(
          `- ${nome} [${cat}] (emb: ${embalagem}, qtd: ${cp.quantidade || 1}) → ${precosStr || "sem preço"}`
        );
      });

      // Compute totals per supplier (wins + full totals for minimum order analysis)
      lines.push("");
      lines.push("Resumo por fornecedor (menor preço vence cada item):");
      const supplierWins: Record<string, { wins: number; total: number; items: string[] }> = {};
      const supplierTotals: Record<string, number> = {};
      const tiedItems: { produto: string; fornecedores: string[]; preco: number }[] = [];

      (cotacaoProdutos || []).forEach((cp: any) => {
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
        if (!cpPrecos.length) return;
        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        const winners = cpPrecos.filter((p: any) => p.preco === minPrice);

        // Detect ties
        if (winners.length > 1) {
          tiedItems.push({
            produto: cp.produtos?.nome || "?",
            fornecedores: winners.map((w: any) => fornecedorMap[w.fornecedor_id] || "?"),
            preco: minPrice,
          });
        }

        const winner = winners[0];
        if (winner) {
          if (!supplierWins[winner.fornecedor_id]) supplierWins[winner.fornecedor_id] = { wins: 0, total: 0, items: [] };
          supplierWins[winner.fornecedor_id].wins++;
          supplierWins[winner.fornecedor_id].total += minPrice * (cp.quantidade || 1);
          supplierWins[winner.fornecedor_id].items.push(cp.produtos?.nome || "?");
        }
        // Track total per supplier for ALL items they quoted
        cpPrecos.forEach((p: any) => {
          if (!supplierTotals[p.fornecedor_id]) supplierTotals[p.fornecedor_id] = 0;
          supplierTotals[p.fornecedor_id] += p.preco * (cp.quantidade || 1);
        });
      });
      Object.entries(supplierWins).forEach(([fid, s]) => {
        lines.push(`- ${fornecedorMap[fid] || "?"}: ${s.wins} itens ganhos, total R$${s.total.toFixed(2)}`);
      });

      const grandTotal = Object.values(supplierWins).reduce((acc, s) => acc + s.total, 0);
      lines.push(`\nTotal geral estimado da compra: R$${grandTotal.toFixed(2)}`);

      // Tied items analysis
      if (tiedItems.length > 0) {
        lines.push("");
        lines.push("⚔️ EMPATES (mesmo preço entre fornecedores):");
        tiedItems.forEach((t) => {
          lines.push(`- ${t.produto}: R$${t.preco.toFixed(2)} empatado entre ${t.fornecedores.join(", ")}`);
        });
        lines.push("DICA: Empates podem ser desempatados redistribuindo para o fornecedor que precisa atingir pedido mínimo.");
      }

      // Pedido mínimo analysis
      lines.push("");
      lines.push("📦 ANÁLISE DE PEDIDO MÍNIMO POR FORNECEDOR:");
      const fornecedoresAbaixoMinimo: { nome: string; faltam: number; totalAtual: number; minimo: number; itensCotados: string[] }[] = [];
      (cotacaoFornecedores || []).forEach((cf: any) => {
        const f = cf.fornecedores;
        const minimo = Number(f?.pedido_minimo || 0);
        const winsData = supplierWins[cf.fornecedor_id];
        const totalVencedor = winsData?.total || 0;
        const totalCotado = supplierTotals[cf.fornecedor_id] || 0;
        const atingiu = minimo <= 0 || totalVencedor >= minimo;
        if (minimo > 0) {
          lines.push(`- ${f?.nome || "?"}: pedido mínimo R$${minimo.toFixed(2)}, total com itens ganhos R$${totalVencedor.toFixed(2)}, total de todos itens cotados R$${totalCotado.toFixed(2)} → ${atingiu ? "✅ ATINGE mínimo" : "❌ NÃO ATINGE mínimo (faltam R$" + (minimo - totalVencedor).toFixed(2) + ")"}`);
          if (!atingiu) {
            // Find items this supplier quoted but didn't win
            const cotadoItems: string[] = [];
            (cotacaoProdutos || []).forEach((cp: any) => {
              const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.fornecedor_id === cf.fornecedor_id && p.preco > 0);
              if (cpPrecos.length > 0 && (!winsData?.items.includes(cp.produtos?.nome))) {
                const p = cpPrecos[0];
                const minP = Math.min(...precos.filter((pr: any) => pr.cotacao_produto_id === cp.id && pr.preco > 0).map((pr: any) => pr.preco));
                const diff = p.preco - minP;
                cotadoItems.push(`${cp.produtos?.nome}: R$${p.preco.toFixed(2)} (melhor: R$${minP.toFixed(2)}, diff: +R$${diff.toFixed(2)})`);
              }
            });
            fornecedoresAbaixoMinimo.push({ nome: f?.nome || "?", faltam: minimo - totalVencedor, totalAtual: totalVencedor, minimo, itensCotados: cotadoItems });
          }
        } else {
          lines.push(`- ${f?.nome || "?"}: sem pedido mínimo, total itens ganhos R$${totalVencedor.toFixed(2)}`);
        }
      });

      // Redistribution suggestions
      if (fornecedoresAbaixoMinimo.length > 0) {
        lines.push("");
        lines.push("🔄 SUGESTÕES DE REDISTRIBUIÇÃO:");
        fornecedoresAbaixoMinimo.forEach((fab) => {
          lines.push(`\n${fab.nome} precisa de mais R$${fab.faltam.toFixed(2)} para atingir mínimo de R$${fab.minimo.toFixed(2)}.`);
          if (fab.itensCotados.length > 0) {
            lines.push("  Itens que poderiam ser movidos para este fornecedor (com custo extra):");
            fab.itensCotados.slice(0, 10).forEach((item) => lines.push(`    • ${item}`));
          }
        });
        lines.push("\nIMPORTANTE: Ao sugerir redistribuição, calcule o custo extra de mover cada item e priorize mover itens com menor diferença de preço.");
      }

      // Items without any price
      const semPreco = (cotacaoProdutos || []).filter((cp: any) => {
        return !precos.some((p: any) => p.cotacao_produto_id === cp.id && p.preco > 0);
      });
      if (semPreco.length > 0) {
        lines.push("");
        lines.push(`⚠️ ${semPreco.length} produto(s) SEM NENHUM PREÇO cotado:`);
        semPreco.forEach((cp: any) => lines.push(`- ${cp.produtos?.nome || "?"}`));
      }

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
- Ao recomendar, considere pedido mínimo dos fornecedores.
- IMPORTANTE: Quando um fornecedor NÃO atingir o pedido mínimo, PROATIVAMENTE sugira quais itens podem ser redistribuídos para ele (priorizando empates e itens com menor diferença de preço) para viabilizar o pedido.
- Em caso de EMPATES, sugira direcionar o item para o fornecedor que mais precisa atingir o pedido mínimo.
- Sempre que possível, apresente os dados em tabelas markdown para facilitar a visualização.
- Quando o usuário pedir uma análise geral, inclua: resumo de economia, fornecedores abaixo do mínimo, empates e sugestão de redistribuição.`;

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
