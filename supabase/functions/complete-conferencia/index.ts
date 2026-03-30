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
    const { pedido_id, conferido_por, observacoes, items, loja_id } = await req.json();

    // Validate required fields
    if (!pedido_id || typeof pedido_id !== "string") {
      return new Response(JSON.stringify({ error: "pedido_id inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conferido_por || typeof conferido_por !== "string" || conferido_por.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nome do conferente é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Itens da conferência são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the pedido exists and is in 'enviado' status
    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("id, status, loja_id")
      .eq("id", pedido_id)
      .eq("status", "enviado")
      .maybeSingle();

    if (pedidoErr || !pedido) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado ou já recebido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: validate loja_id matches if provided
    if (loja_id && pedido.loja_id && pedido.loja_id !== loja_id) {
      return new Response(JSON.stringify({ error: "Pedido não pertence a esta loja" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert conferencia
    const { data: conf, error: confError } = await supabase
      .from("conferencias")
      .insert({
        pedido_id,
        conferido_por: conferido_por.trim(),
        observacoes: observacoes || null,
      })
      .select("id")
      .single();

    if (confError) {
      console.error("Error inserting conferencia:", confError);
      return new Response(JSON.stringify({ error: "Erro ao criar conferência" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert conferencia items
    const insertItems = items.map((item: any) => ({
      conferencia_id: conf.id,
      produto_nome: String(item.produto_nome || ""),
      embalagem: item.embalagem || null,
      quantidade_pedida: Number(item.quantidade_pedida) || 0,
      quantidade_recebida: Number(item.quantidade_recebida) || 0,
      preco_cotado: item.preco_cotado != null ? Number(item.preco_cotado) : null,
      preco_nf: item.preco_nf != null ? Number(item.preco_nf) : null,
      divergencia_qtd: Number(item.quantidade_recebida) !== Number(item.quantidade_pedida),
      divergencia_preco: item.preco_nf != null && item.preco_cotado != null && Number(item.preco_nf) !== Number(item.preco_cotado),
    }));

    const { error: itensError } = await supabase
      .from("conferencia_itens")
      .insert(insertItems);

    if (itensError) {
      console.error("Error inserting conferencia_itens:", itensError);
      return new Response(JSON.stringify({ error: "Erro ao salvar itens da conferência" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update pedido status to recebido
    const { error: updateErr } = await supabase
      .from("pedidos")
      .update({ status: "recebido" })
      .eq("id", pedido_id)
      .eq("status", "enviado");

    if (updateErr) {
      console.error("Error updating pedido status:", updateErr);
      return new Response(JSON.stringify({ error: "Erro ao atualizar status do pedido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, conferencia_id: conf.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("complete-conferencia error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
