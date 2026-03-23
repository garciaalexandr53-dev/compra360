import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ModalAiAnaliseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  loading: boolean;
  onReanalisar: () => void;
}

const ModalAiAnalise = ({ open, onOpenChange, text, loading, onReanalisar }: ModalAiAnaliseProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise Inteligente de Preços
          </DialogTitle>
        </DialogHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 min-h-[200px]">
          {loading && !text && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analisando preços com IA...</span>
            </div>
          )}
          {text && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onReanalisar} disabled={loading} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Reanalisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalAiAnalise;
