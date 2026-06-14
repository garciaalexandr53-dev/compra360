import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, SkipForward, Smartphone, History } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import {
  acaoParaEnvio,
  ENVIO_STATUS,
  type EnvioStatus,
} from "@/lib/envioStatus";
import {
  fetchStatusEnviosCotacao,
  registrarEnvio,
} from "@/lib/envioFornecedor";
import StatusEnvioBadge from "@/components/cotacao/StatusEnvioBadge";
import HistoricoEnviosSheet from "@/components/cotacao/HistoricoEnviosSheet";

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
  cotacaoId: string | null;
  onSendOrder: (fornecedor: Fornecedor) => void;
  onConclude?: () => void;
}

const SKIP_KEY = "send-orders-skipped";

/**
 * Sequential WhatsApp queue with persistent per-supplier status.
 * - Status reflects cotacao_fornecedores.status_envio (DB single source of truth).
 * - "Reenviar" is always available, even after a supplier is marked enviado.
 * - "Pular" is local-only (no permanent status); it just hides from the active queue.
 * - Tap on status badge opens the histórico sheet for that supplier.
 */
const SendOrdersModal = ({
  open,
  onOpenChange,
  orders,
  cotacaoId,
  onSendOrder,
  onConclude,
}: Props) => {
  const qc = useQueryClient();

  const { data: statusRows } = useQuery({
    queryKey: ["cotacao-fornecedores-status", cotacaoId],
    enabled: !!cotacaoId && open,
    queryFn: () => fetchStatusEnviosCotacao(cotacaoId!),
    refetchOnWindowFocus: true,
  });

  const statusMap: Record<string, EnvioStatus> = {};
  (statusRows ?? []).forEach((r) => {
    statusMap[r.fornecedor_id] = r.status_envio;
  });

  const [skipped, setSkipped] = useState<Record<string, true>>(() => {
    try {
      const raw = localStorage.getItem(SKIP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SKIP_KEY, JSON.stringify(skipped));
    } catch {}
  }, [skipped]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFornecedor, setHistoryFornecedor] = useState<Fornecedor | null>(null);

  const total = orders.length;
  const enviadoCount = orders.filter(
    (o) => statusMap[o.fornecedor.id] === ENVIO_STATUS.ENVIADO
      || statusMap[o.fornecedor.id] === ENVIO_STATUS.ENTREGUE,
  ).length;
  const pendingOrders = orders.filter(
    (o) => (statusMap[o.fornecedor.id] ?? ENVIO_STATUS.PENDENTE) === ENVIO_STATUS.PENDENTE
      && !skipped[o.fornecedor.id],
  );
  const nextPending = pendingOrders[0];
  const allHandled = total > 0 && pendingOrders.length === 0;

  const handleSend = async (o: SupplierOrder, isReenvio: boolean) => {
    onSendOrder(o.fornecedor); // open WhatsApp first (don't block UX)
    if (!cotacaoId) return;
    const acao = isReenvio
      ? acaoParaEnvio(statusMap[o.fornecedor.id])
      : acaoParaEnvio(statusMap[o.fornecedor.id]);
    try {
      await registrarEnvio({
        cotacaoId,
        fornecedorId: o.fornecedor.id,
        acao,
        status: ENVIO_STATUS.ENVIADO,
        metadata: { total: o.total, itens: o.items.length },
      });
      await qc.invalidateQueries({ queryKey: ["cotacao-fornecedores-status", cotacaoId] });
      await qc.invalidateQueries({ queryKey: ["historico-envios", cotacaoId, o.fornecedor.id] });
    } catch (e: any) {
      toast.error("Não foi possível registrar o envio: " + (e?.message ?? "erro"));
    }
  };

  const skip = (id: string) => setSkipped((p) => ({ ...p, [id]: true }));
  const unskip = (id: string) =>
    setSkipped((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });

  const handleConclude = () => {
    try {
      localStorage.removeItem(SKIP_KEY);
    } catch {}
    setSkipped({});
    onOpenChange(false);
    onConclude?.();
  };

  const openHistory = (f: Fornecedor) => {
    setHistoryFornecedor(f);
    setHistoryOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg pr-6">
              📦 Enviando pedidos para fornecedores
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium flex items-center justify-between">
            <span>
              <strong>{enviadoCount}</strong> de <strong>{total}</strong> pedidos enviados
            </span>
            {enviadoCount === total && total > 0 && (
              <span className="text-green-700 dark:text-green-400 text-xs">✓ todos enviados</span>
            )}
          </div>

          <ScrollArea className="max-h-[60vh] sm:max-h-[420px] mt-2">
            <div className="space-y-2 pr-2">
              {orders.map((o) => {
                const status = (statusMap[o.fornecedor.id] ?? ENVIO_STATUS.PENDENTE) as EnvioStatus;
                const isEnviado = status !== ENVIO_STATUS.PENDENTE;
                const isSkipped = !!skipped[o.fornecedor.id];
                const isNext = !isSkipped && !isEnviado && o.fornecedor.id === nextPending?.fornecedor.id;
                return (
                  <div
                    key={o.fornecedor.id}
                    className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${
                      isEnviado
                        ? "bg-green-50/60 dark:bg-green-950/15 border-green-200/70 dark:border-green-900"
                        : isSkipped
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 opacity-70"
                        : isNext
                        ? "bg-primary/5 border-primary/30 shadow-sm"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground break-words">
                            {o.fornecedor.nome}
                          </p>
                          {isNext && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                              Próximo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.items.length} {o.items.length === 1 ? "item" : "itens"} ·{" "}
                          {formatBRL(o.total)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <StatusEnvioBadge status={status} onClick={() => openHistory(o.fornecedor)} />
                          <button
                            type="button"
                            onClick={() => openHistory(o.fornecedor)}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            <History className="h-3 w-3" />
                            Histórico
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {!isEnviado && !isSkipped && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleSend(o, false)}
                        >
                          <Smartphone className="h-3.5 w-3.5 mr-1" /> Enviar
                        </Button>
                      )}
                      {(isEnviado || isSkipped) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (isSkipped) unskip(o.fornecedor.id);
                            handleSend(o, true);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          {isEnviado ? "Reenviar" : "Enviar"}
                        </Button>
                      )}
                      {!isEnviado && !isSkipped && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => skip(o.fornecedor.id)}
                        >
                          <SkipForward className="h-3.5 w-3.5 mr-1" />
                          Pular
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {allHandled ? (
            <div className="pt-3 border-t">
              <Button onClick={handleConclude} className="w-full">
                Concluir
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>✅ {enviadoCount} enviado(s)</span>
              <span>⏳ {pendingOrders.length} pendente(s)</span>
              <Button size="sm" variant="ghost" className="text-xs" onClick={handleConclude}>
                Encerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <HistoricoEnviosSheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        cotacaoId={cotacaoId}
        fornecedorId={historyFornecedor?.id ?? null}
        fornecedorNome={historyFornecedor?.nome}
      />
    </>
  );
};

export default SendOrdersModal;
