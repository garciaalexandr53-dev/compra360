import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, HandCoins, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBRL, formatDate } from "@/lib/format";

export type MetodoManual = "pix" | "transferencia" | "dinheiro" | "boleto" | "outro";
export type CicloManual = "mensal" | "anual";

export const METODO_LABEL: Record<MetodoManual, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  outro: "Outro",
};

export const CICLO_LABEL: Record<CicloManual, string> = {
  mensal: "Mensal (30 dias)",
  anual: "Anual (12 meses)",
};

export type PagamentoManual = {
  id: string;
  valor: number | null;
  metodo: string;
  ciclo: string;
  periodo_inicio: string;
  periodo_fim: string;
  observacao: string | null;
  plan_name: string;
  created_at: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  email: string | null;
  planoAtual?: string;
  vencimentoAtual?: string | null;
}

function toInputDate(d: Date): string {
  const off = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return off.toISOString().slice(0, 10);
}

/** Base para o novo período: encadeia a partir do vencimento atual se ele for futuro. */
export function calcularVencimento(ciclo: CicloManual, vencimentoAtual?: string | null): Date {
  const agora = new Date();
  const atual = vencimentoAtual ? new Date(vencimentoAtual) : null;
  const base = atual && atual.getTime() > agora.getTime() ? atual : agora;
  const fim = new Date(base);
  if (ciclo === "anual") fim.setMonth(fim.getMonth() + 12);
  else fim.setDate(fim.getDate() + 30);
  return fim;
}

export default function PagamentoManualDialog({
  open, onOpenChange, userId, email, planoAtual, vencimentoAtual,
}: Props) {
  const queryClient = useQueryClient();
  const [plano, setPlano] = useState<"business" | "pro">("business");
  const [ciclo, setCiclo] = useState<CicloManual>("anual");
  const [metodo, setMetodo] = useState<MetodoManual>("pix");
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open) return;
    setPlano(planoAtual === "pro" ? "pro" : "business");
    setCiclo("anual");
    setMetodo("pix");
    setValor("");
    setObservacao("");
    setVencimento(toInputDate(calcularVencimento("anual", vencimentoAtual)));
  }, [open, planoAtual, vencimentoAtual]);

  const sugestao = useMemo(() => calcularVencimento(ciclo, vencimentoAtual), [ciclo, vencimentoAtual]);

  // Já pago por mais de 30 dias? Avisar antes de encadear outro período.
  const jaPagoAlem30 = useMemo(() => {
    if (!vencimentoAtual) return false;
    const dias = (new Date(vencimentoAtual).getTime() - Date.now()) / 86400000;
    return dias > 30;
  }, [vencimentoAtual]);
  const [confirmado, setConfirmado] = useState(false);
  useEffect(() => {
    if (open) setConfirmado(false);
  }, [open]);

  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ["admin-pagamentos-manuais", userId],
    enabled: open && !!userId,
    queryFn: async (): Promise<PagamentoManual[]> => {
      const { data, error } = await (supabase.rpc as never as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: PagamentoManual[] | null; error: { message: string } | null }>)(
        "admin_list_pagamentos_manuais", { _user_id: userId },
      );
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const valorNum = valor.trim() ? Number(valor.replace(",", ".")) : null;
      if (valorNum !== null && (!Number.isFinite(valorNum) || valorNum < 0)) {
        throw new Error("Valor inválido");
      }
      const iso = vencimento ? new Date(`${vencimento}T23:59:59`).toISOString() : null;
      const { data, error } = await (supabase.rpc as never as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "admin_registrar_pagamento_manual",
        {
          _user_id: userId,
          _plan_name: plano,
          _ciclo: ciclo,
          _vencimento: iso,
          _metodo: metodo,
          _valor: valorNum,
          _observacao: observacao.trim() || null,
        },
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Pagamento registrado",
        description: `Plano ${plano} ativo até ${formatDate(new Date(`${vencimento}T12:00:00`).toISOString())}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-assinaturas-manuais"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pagamentos-manuais", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-cliente-detalhes", userId] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <HandCoins className="h-5 w-5 text-primary" />
            Registrar pagamento manual
          </DialogTitle>
          <DialogDescription className="text-left break-all">
            {email || "Cliente"} — pagamento recebido fora do Stripe (Pix, transferência etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={plano} onValueChange={(v) => setPlano(v as "business" | "pro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select
                value={ciclo}
                onValueChange={(v) => {
                  const novo = v as CicloManual;
                  setCiclo(novo);
                  setVencimento(toInputDate(calcularVencimento(novo, vencimentoAtual)));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">{CICLO_LABEL.mensal}</SelectItem>
                  <SelectItem value="anual">{CICLO_LABEL.anual}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-venc">Vencimento</Label>
              <Input
                id="pm-venc"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Sugerido: {formatDate(sugestao.toISOString())}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoManual)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(METODO_LABEL) as MetodoManual[]).map((m) => (
                    <SelectItem key={m} value={m}>{METODO_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-valor">Valor recebido (R$)</Label>
            <Input
              id="pm-valor"
              inputMode="decimal"
              placeholder="Ex: 970,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pm-obs">Observação</Label>
            <Textarea
              id="pm-obs"
              rows={2}
              placeholder="Ex: Pix recebido em 18/08, comprovante no WhatsApp"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Pagamentos manuais anteriores
            </h4>
            {loadingHistorico ? (
              <div className="py-3 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !historico || historico.length === 0 ? (
              <p className="text-sm text-muted-foreground italic mt-2">
                Nenhum pagamento manual registrado ainda.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {historico.map((p) => (
                  <li key={p.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">
                        {p.valor != null ? formatBRL(Number(p.valor)) : "Valor não informado"}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {METODO_LABEL[p.metodo as MetodoManual] || p.metodo}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {p.plan_name} · {p.ciclo}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Cobre {formatDate(p.periodo_inicio)} até {formatDate(p.periodo_fim)} · registrado em{" "}
                      {formatDate(p.created_at)}
                    </div>
                    {p.observacao && (
                      <div className="text-xs text-muted-foreground mt-0.5 break-words">{p.observacao}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => registrar.mutate()}
            disabled={registrar.isPending || !userId || !vencimento}
            className="w-full sm:w-auto"
          >
            {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar e liberar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
