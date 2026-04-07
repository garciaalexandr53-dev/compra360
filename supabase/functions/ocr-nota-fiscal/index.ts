import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image_base64, mode } = await req.json();
    // mode: "conferencia" | "importar"

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!image_base64) throw new Error("Imagem não fornecida");

    const systemPrompt = mode === "conferencia"
      ? `Você é um especialista em leitura de notas fiscais brasileiras. Extraia TODOS os itens da nota fiscal.
Para cada item, retorne: nome do produto, quantidade, valor unitário.
Retorne APENAS um JSON array, sem markdown:
[{"produto": "nome", "quantidade": 1, "preco_unitario": 12.50}]
Se não conseguir ler algum campo, use null. Seja preciso nos valores numéricos.`
      : `Você é um especialista em leitura de notas fiscais brasileiras. Extraia TODOS os itens da nota fiscal.
Para cada item, retorne: nome do produto, quantidade, valor unitário, e embalagem (unidade/pacote/caixa/kg/etc).
Também extraia dados do fornecedor: nome/razão social, CNPJ, e data da NF.
Retorne APENAS JSON, sem markdown:
{"fornecedor": {"nome": "...", "cnpj": "...", "data_nf": "DD/MM/AAAA"}, "itens": [{"produto": "nome", "quantidade": 1, "preco_unitario": 12.50, "embalagem": "un"}]}
Se não conseguir ler algum campo, use null.`;

    // Detect mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    if (image_base64.startsWith("data:")) {
      const match = image_base64.match(/^data:(image\/[a-z+]+);base64,/);
      if (match) mimeType = match[1];
    }

    // Strip data URI prefix if present
    const rawBase64 = image_base64.replace(/^data:image\/[a-z+]+;base64,/, "");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta nota fiscal:" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${rawBase64}` } },
            ],
          },
        ],
        stream: false,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Configurações." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erro ao processar imagem com IA");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from possible markdown code block
    const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) content = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse OCR response:", content);
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados da nota fiscal. Tente com uma foto mais nítida." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-nota-fiscal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
