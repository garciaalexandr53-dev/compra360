import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Target } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ModalFornecedorSugestaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  loading: boolean;
  hasHistory: boolean;
  recommendedIds: string[];
  onApply: () => void;
}

const ModalFornecedorSugestao = ({ open, onOpenChange, text, loading, hasHistory, recommendedIds, onApply }: ModalFornecedorSugestaoProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && text) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Fornecedores Recomendados
          </DialogTitle>
        </DialogHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-[200px]">
          {loading && !text && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analisando histórico de fornecedores...</span>
            </div>
          )}
          {!loading && !hasHistory && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Ainda não há histórico suficiente.</p>
              <p className="text-xs text-muted-foreground mt-2">Continue usando o Compra360 e as sugestões ficarão cada vez mais precisas!</p>
            </div>
          )}
          {text && (
            <div className="prose prose-sm dark:prose-invert max-w-none px-1">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {hasHistory && recommendedIds.length > 0 && (
            <Button onClick={onApply} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              Aplicar sugestões ({recommendedIds.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalFornecedorSugestao;
