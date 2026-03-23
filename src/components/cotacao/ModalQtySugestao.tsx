import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wand2, Loader2 } from "lucide-react";

interface QtySuggestion {
  cotacao_produto_id: string;
  nome: string;
  quantidade_sugerida: number;
  justificativa: string;
}

interface ModalQtySugestaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: QtySuggestion[];
  loading: boolean;
  onApply: () => void;
}

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
              <span className="text-sm">Analisando histórico...</span>
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma sugestão disponível.</p>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.nome}</span>
                    <span className="text-primary font-bold text-sm">Qtd: {s.quantidade_sugerida}</span>
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
