import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, SkipForward, Smartphone } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";

type Fornecedor = Tables<"fornecedores">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedores: Fornecedor[];
}

type Status = "pending" | "sent" | "skipped";

const STORAGE_KEY = "send-queue-state";

const SendQueueModal = ({ open, onOpenChange, fornecedores, onConclude }: Props & { onConclude?: () => void }) => {
  const { lojaAtiva } = useLojaAtiva();

  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Initialize statuses when fornecedores change
  useEffect(() => {
    if (!fornecedores.length) return;
    setStatuses(prev => {
      const next = { ...prev };
      let changed = false;
      fornecedores.forEach(f => {
        if (!next[f.id]) { next[f.id] = "pending"; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [fornecedores]);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses)); } catch {}
  }, [statuses]);

  const getLink = (f: Fornecedor) => {
    const publicOrigin = (import.meta.env.VITE_APP_PUBLIC_URL || "https://compra360.lovable.app").replace(/\/$/, "");
    const base = `${publicOrigin}/fornecedor/${f.token}`;
    return lojaAtiva?.id ? `${base}?loja=${lojaAtiva.id}` : base;
  };

  const openWhatsApp = (f: Fornecedor) => {
    const link = getLink(f);
    const msg = `Olá ${f.nome}! Segue o link para cotação de preços:\n\n${link}\n\nPreencha os preços e envie. Obrigado!`;
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setStatuses(prev => ({ ...prev, [f.id]: "sent" }));
  };

  const skip = (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: "skipped" }));
  };

  const sentCount = Object.values(statuses).filter(s => s === "sent").length;
  const skippedCount = Object.values(statuses).filter(s => s === "skipped").length;
  const allDone = fornecedores.length > 0 && fornecedores.every(f => statuses[f.id] !== "pending");

  // Find next pending
  const nextPending = fornecedores.find(f => statuses[f.id] === "pending");

  const handleConclude = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setStatuses({});
    onOpenChange(false);
    onConclude?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📤 Enviando cotação para fornecedores</DialogTitle>
        </DialogHeader>

        {allDone ? (
          <div className="text-center py-6 animate-fade-in">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-lg font-bold text-foreground mb-1">Envio concluído!</p>
            <p className="text-sm text-muted-foreground mb-4">
              {sentCount} enviado(s) · {skippedCount} pulado(s)
            </p>
            <Button onClick={handleConclude} className="w-full">Concluir</Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-2">
              {fornecedores.map(f => {
                const status = statuses[f.id] || "pending";
                const isNext = f.id === nextPending?.id;
                return (
                  <div key={f.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    status === "sent" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                    : status === "skipped" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 opacity-60" 
                    : isNext ? "bg-primary/5 border-primary/30 shadow-sm" 
                    : "border-border"
                  }`}>
                    <div className="shrink-0">
                      {status === "sent" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      {status === "skipped" && <SkipForward className="h-5 w-5 text-amber-500" />}
                      {status === "pending" && <Clock className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{f.nome}</p>
                      {f.telefone && <p className="text-xs text-muted-foreground">{f.telefone}</p>}
                    </div>
                    {status === "pending" && (
                      <div className="flex gap-1.5 shrink-0">
                        {isNext && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs" onClick={() => openWhatsApp(f)}>
                            <Smartphone className="h-3 w-3 mr-1" /> WhatsApp
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => skip(f.id)}>
                          Pular
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {!allDone && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>✅ {sentCount} enviado(s)</span>
            <span>⏭️ {skippedCount} pulado(s)</span>
            <span>⏳ {fornecedores.length - sentCount - skippedCount} restante(s)</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendQueueModal;
