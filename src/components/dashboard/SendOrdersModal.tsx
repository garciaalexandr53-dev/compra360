import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, SkipForward, Smartphone } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

interface OrderItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  fator: number;
  preco: number;
  total: number;
}

interface SupplierOrder {
  fornecedor: Fornecedor;
  items: OrderItem[];
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: SupplierOrder[];
  onSendOrder: (fornecedor: Fornecedor) => void;
  onConclude?: () => void;
}

type Status = "pending" | "sent" | "skipped";

const STORAGE_KEY = "send-orders-state";

const SendOrdersModal = ({ open, onOpenChange, orders, onSendOrder, onConclude }: Props) => {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    if (!orders.length) return;
    setStatuses(prev => {
      const next = { ...prev };
      let changed = false;
      orders.forEach(o => {
        if (!next[o.fornecedor.id]) { next[o.fornecedor.id] = "pending"; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [orders]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses)); } catch {}
  }, [statuses]);

  const handleSend = (o: SupplierOrder) => {
    onSendOrder(o.fornecedor);
    setStatuses(prev => ({ ...prev, [o.fornecedor.id]: "sent" }));
    onOpenChange(false);
  };

  const skip = (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: "skipped" }));
  };

  const sentCount = Object.values(statuses).filter(s => s === "sent").length;
  const skippedCount = Object.values(statuses).filter(s => s === "skipped").length;
  const allDone = orders.length > 0 && orders.every(o => statuses[o.fornecedor.id] !== "pending");
  const nextPending = orders.find(o => statuses[o.fornecedor.id] === "pending");

  const handleConclude = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setStatuses({});
    onOpenChange(false);
    onConclude?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg pr-6">📦 Enviando pedidos para fornecedores</DialogTitle>
        </DialogHeader>

        {allDone ? (
          <div className="text-center py-6 animate-fade-in">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-lg font-bold text-foreground mb-1">Pedidos enviados!</p>
            <p className="text-sm text-muted-foreground mb-4">
              {sentCount} enviado(s) · {skippedCount} pulado(s)
            </p>
            <Button onClick={handleConclude} className="w-full">Concluir</Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
            <div className="space-y-2 pr-2">
              {orders.map(o => {
                const status = statuses[o.fornecedor.id] || "pending";
                const isNext = o.fornecedor.id === nextPending?.fornecedor.id;
                return (
                  <div key={o.fornecedor.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all ${
                    status === "sent" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : status === "skipped" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 opacity-60"
                    : isNext ? "bg-primary/5 border-primary/30 shadow-sm"
                    : "border-border"
                  }`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">
                        {status === "sent" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        {status === "skipped" && <SkipForward className="h-5 w-5 text-amber-500" />}
                        {status === "pending" && <Clock className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground break-words">{o.fornecedor.nome}</p>
                          {isNext && status === "pending" && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                              Próximo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {o.items.length} {o.items.length === 1 ? "item" : "itens"} · {formatBRL(o.total)}
                        </p>
                      </div>
                    </div>
                    {status === "pending" && (
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        {isNext && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none" onClick={() => handleSend(o)}>
                            <Smartphone className="h-3.5 w-3.5 mr-1" /> Enviar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-muted-foreground flex-1 sm:flex-none" onClick={() => skip(o.fornecedor.id)}>
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
            <span>⏳ {orders.length - sentCount - skippedCount} restante(s)</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendOrdersModal;
