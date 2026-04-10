import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { formatBRL } from "@/lib/format";
import { Loader2, Handshake, TrendingDown, Copy, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string | null;
  fornecedores: Fornecedor[];
}

interface NegResult {
  text: string;
  fornecedor_nome: string;
  total_fornecedor: number;
  total_melhor: number;
  wins: number;
  losses: number;
  total_items: number;
}

const NegociacaoModal = ({ open, onOpenChange, cotacaoId, fornecedores }: Props) => {
  const { lojaAtiva } = useLojaAtiva();
  const [selectedForn, setSelectedForn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegResult | null>(null);
  const [copied, setCopied] = useState(false);

  const analyze = async (fornId: string) => {
    if (!cotacaoId) return;
    setSelectedForn(fornId);
    setLoading(true);
    setResult(null);
    try {
      const resp = await supabase.functions.invoke("ai-automacao", {
        body: { type: "negotiate", cotacao_id: cotacaoId, fornecedor_id: fornId, loja_id: lojaAtiva?.id },
      });
      if (resp.error) throw new Error(resp.error.message);
      setResult(resp.data as NegResult);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar argumentos");
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    toast.success("Argumentos copiados!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setSelectedForn(null); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Negociação Assistida por IA
          </DialogTitle>
        </DialogHeader>

        {!result && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione um fornecedor para gerar argumentos de negociação baseados em comparativos de preço e tendências históricas.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {fornecedores.map((f) => (
                <button
                  key={f.id}
                  onClick={() => analyze(f.id)}
                  className="flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-accent transition-colors"
                >
                  <TrendingDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">{f.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando preços e gerando argumentos...</p>
          </div>
        )}

        {result && (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Total atual</div>
                <div className="text-sm font-bold font-mono">{formatBRL(result.total_fornecedor)}</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Melhor possível</div>
                <div className="text-sm font-bold font-mono text-green-600">{formatBRL(result.total_melhor)}</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Vence em</div>
                <div className="text-sm font-bold">{result.wins}/{result.total_items}</div>
              </div>
            </div>

            {result.losses > 0 && (
              <Badge variant="outline" className="w-fit text-xs">
                {result.losses} item(ns) mais caro(s) que a concorrência
              </Badge>
            )}

            {/* AI content */}
            <ScrollArea className="flex-1 min-h-0 max-h-[45vh]">
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1 [&_li]:my-0.5 [&_h2]:text-sm [&_h3]:text-sm pr-2">
                <ReactMarkdown>{result.text}</ReactMarkdown>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" className="flex-1" onClick={copyText}>
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? "Copiado!" : "Copiar argumentos"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setResult(null); setSelectedForn(null); }}>
                Outro fornecedor
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NegociacaoModal;
