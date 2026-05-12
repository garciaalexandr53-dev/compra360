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
      if (
        !p.cotacao_produto_id ||
        typeof p.preco !== "number" ||
        !Number.isFinite(p.preco) ||
        p.preco < 0
      ) {
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

    // Validate that all cotacao_produto_ids belong to an active cotação within prazo
    const cpIds = prices.map((p: any) => p.cotacao_produto_id);
    const { data: validCps } = await supabase
      .from("cotacao_produtos")
      .select("id, cotacao_id, cotacoes!inner(status, prazo_resposta)")
      .in("id", cpIds)
      .eq("cotacoes.status", "ativa");

    // Filter out items whose cotação prazo has expired
    const nowMs = Date.now();
    const validCpIds = new Set(
      (validCps || [])
        .filter((cp: any) => {
          const prazo = cp.cotacoes?.prazo_resposta;
          if (!prazo) return true;
          return new Date(prazo).getTime() > nowMs;
        })
        .map((cp: any) => cp.id)
    );

    if (validCpIds.size === 0) {
      return new Response(
        JSON.stringify({ error: "Prazo encerrado ou cotação não está mais ativa." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build upsert payload only for valid cotacao_produtos
    const rows = prices
      .filter((p: any) => validCpIds.has(p.cotacao_produto_id))
      .map((p: any) => ({
        cotacao_produto_id: p.cotacao_produto_id,
        fornecedor_id: supplierId,
        preco: p.preco,
      }));

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum item válido para registrar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single upsert (much faster than per-row select+update/insert).
    const { error: upsertErr } = await supabase
      .from("precos")
      .upsert(rows, { onConflict: "cotacao_produto_id,fornecedor_id" });

    if (upsertErr) {
      console.error("submit-precos upsert error:", upsertErr);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar preços: " + upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("submit-precos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
