import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wand2, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface QtySuggestion {
  cotacao_produto_id: string;
  nome: string;
  quantidade_sugerida: number;
  justificativa: string;
  tendencia?: "crescente" | "estável" | "diminuindo" | "sem_historico";
}

interface ModalQtySugestaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: QtySuggestion[];
  loading: boolean;
  onApply: () => void;
}

const trendIcon = (t?: string) => {
  if (t === "crescente") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (t === "diminuindo") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  if (t === "estável") return <Minus className="h-3.5 w-3.5 text-blue-500" />;
  return null;
};

const trendBadge = (t?: string) => {
  if (t === "crescente") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">↑ Crescente</Badge>;
  if (t === "diminuindo") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">↓ Diminuindo</Badge>;
  if (t === "estável") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">— Estável</Badge>;
  if (t === "sem_historico") return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Sem histórico</Badge>;
  return null;
};

const ModalQtySugestao = ({ open, onOpenChange, suggestions, loading, onApply }: ModalQtySugestaoProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Sugestão de Quantidades (IA)
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analisando histórico de 5 cotações...</span>
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma sugestão disponível.</p>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {trendIcon(s.tendencia)}
                      <span className="font-medium text-sm truncate">{s.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {trendBadge(s.tendencia)}
                      <span className="text-primary font-bold text-sm">Qtd: {s.quantidade_sugerida}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.justificativa}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onApply} disabled={!suggestions.length} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
            Aplicar Sugestões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalQtySugestao;
