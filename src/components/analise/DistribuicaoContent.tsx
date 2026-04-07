import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const DistribuicaoContent = () => {
  const { lojaAtiva } = useLojaAtiva();
  const [analysisText, setAnalysisText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const runAnalysis = async () => {
    if (!cotacaoAtiva?.id) return;
    setAnalysisText("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-distribuicao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro na análise de distribuição");
        setLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalysisText(fullText);
            }
          } catch { /* partial JSON */ }
        }
      }

      // flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalysisText(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na análise");
    } finally {
      setLoading(false);
    }
  };

  if (!cotacaoAtiva) {
    return <div className="py-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Distribuição Inteligente
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            A IA analisa preços, pedido mínimo e histórico para sugerir a melhor distribuição de pedidos.
          </p>
        </div>
        <Button
          onClick={runAnalysis}
          disabled={loading}
          className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : analysisText ? (
            <RefreshCw className="h-4 w-4 mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {loading ? "Analisando..." : analysisText ? "Reanalisar" : "Gerar Sugestão"}
        </Button>
      </div>

      {/* Content */}
      {!analysisText && !loading && (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">
            Clique em <strong>"Gerar Sugestão"</strong> para que a IA analise sua cotação
          </p>
          <p className="text-xs text-muted-foreground">
            Considera pedido mínimo, melhor preço e histórico de entregas de cada fornecedor
          </p>
        </div>
      )}

      {loading && !analysisText && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Analisando distribuição com IA...</span>
        </div>
      )}

      {analysisText && (
        <div ref={scrollRef} className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{analysisText}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistribuicaoContent;
