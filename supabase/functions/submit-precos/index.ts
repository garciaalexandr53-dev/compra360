import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, prices } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(prices) || prices.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum preço enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each price entry
    for (const p of prices) {
      if (!p.cotacao_produto_id || typeof p.preco !== "number" || p.preco < 0) {
        return new Response(JSON.stringify({ error: "Dados de preço inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token and get supplier ID
    const { data: supplierId, error: rpcErr } = await supabase.rpc(
      "get_supplier_id_from_token",
      { _token: token }
    );

    if (rpcErr || !supplierId) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that all cotacao_produto_ids belong to an active cotação
    const cpIds = prices.map((p: any) => p.cotacao_produto_id);
    // Accept submissions while cotação is ativa OR finalizada (not cancelada),
    // so suppliers can still send prices if the requester finalized early.
    const { data: validCps } = await supabase
      .from("cotacao_produtos")
      .select("id, cotacao_id, cotacoes!inner(status)")
      .in("id", cpIds)
      .in("cotacoes.status", ["ativa", "finalizada"]);

    const validCpIds = new Set((validCps || []).map((cp: any) => cp.id));

    // Upsert prices only for valid cotacao_produtos
    let upsertedCount = 0;
    for (const p of prices) {
      if (!validCpIds.has(p.cotacao_produto_id)) continue;

      const { data: existing } = await supabase
        .from("precos")
        .select("id")
        .eq("cotacao_produto_id", p.cotacao_produto_id)
        .eq("fornecedor_id", supplierId)
        .maybeSingle();

      if (existing) {
        await supabase.from("precos").update({ preco: p.preco }).eq("id", existing.id);
      } else {
        await supabase.from("precos").insert({
          cotacao_produto_id: p.cotacao_produto_id,
          fornecedor_id: supplierId,
          preco: p.preco,
        });
      }
      upsertedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, count: upsertedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("submit-precos error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
