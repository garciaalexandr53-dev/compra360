import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, HandCoins, MessageCircle, RefreshCw } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { normalizarWhatsAppCliente } from "@/lib/adminHelpers";
import PagamentoManualDialog, { METODO_LABEL, MetodoManual } from "./PagamentoManualDialog";

type AssinaturaManual = {
  user_id: string;
  email: string | null;
  whatsapp: string | null;
  plan_name: string;
  ciclo: string | null;
  metodo_pagamento: string | null;
  valor_pago: number | null;
  status: string;
  current_period_end: string | null;
  dias_restantes: number | null;
  ultimo_pagamento_at: string | null;
};

export function vencimentoBadge(dias: number | null) {
  if (dias === null) return { label: "Sem vencimento", variant: "outline" as const };
  if (dias < 0) return { label: `Vencida há ${Math.abs(dias)}d`, variant: "destructive" as const };
  if (dias <= 1) return { label: "Vence hoje/amanhã", variant: "destructive" as const };
  if (dias <= 3) return { label: `Vence em ${dias}d`, variant: "destructive" as const };
  if (dias <= 7) return { label: `Vence em ${dias}d`, variant: "secondary" as const };
  return { label: `${dias} dias restantes`, variant: "outline" as const };
}

export default function AssinaturasManuaisSection() {
  const [alvo, setAlvo] = useState<AssinaturaManual | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-assinaturas-manuais"],
    queryFn: async (): Promise<AssinaturaManual[]> => {
      const { data, error } = await (supabase.rpc as never as (
        fn: string,
      ) => Promise<{ data: AssinaturaManual[] | null; error: { message: string } | null }>)(
        "admin_list_assinaturas_manuais",
      );
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { aVencer, restantes } = useMemo(() => {
    const lista = data ?? [];
    return {
      aVencer: lista.filter((a) => a.dias_restantes !== null && a.dias_restantes <= 7),
      restantes: lista.filter((a) => a.dias_restantes === null || a.dias_restantes > 7),
    };
  }, [data]);

  const abrir = (a: AssinaturaManual) => {
    setAlvo(a);
    setDialogOpen(true);
  };

  const linha = (a: AssinaturaManual) => {
    const b = vencimentoBadge(a.dias_restantes);
    const zap = normalizarWhatsAppCliente(a.whatsapp);
    return (
      <li key={a.user_id} className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{a.email || a.user_id}</div>
            <div className="text-xs text-muted-foreground truncate">
              {a.plan_name}
              {a.ciclo ? ` · ${a.ciclo}` : ""}
              {a.metodo_pagamento
                ? ` · ${METODO_LABEL[a.metodo_pagamento as MetodoManual] || a.metodo_pagamento}`
                : ""}
              {a.valor_pago != null ? ` · ${formatBRL(Number(a.valor_pago))}` : ""}
            </div>
          </div>
          <Badge variant={b.variant} className="shrink-0">{b.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Vence em {a.current_period_end ? formatDate(a.current_period_end) : "—"}
          </span>
          <div className="flex gap-2">
            {zap && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://wa.me/${zap}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  Cobrar
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => abrir(a)}>
              <HandCoins className="h-4 w-4" />
              Registrar
            </Button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Assinaturas manuais (Pix / transferência)
          </h2>
          <p className="text-xs text-muted-foreground">
            Pagamentos recebidos fora do Stripe. Registre a renovação antes do vencimento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma assinatura manual registrada. Use "Registrar pagamento manual" no perfil do cliente.
            </div>
          ) : (
            <div className="divide-y">
              {aVencer.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-destructive bg-destructive/5">
                    A vencer / vencidas ({aVencer.length})
                  </div>
                  <ul className="divide-y">{aVencer.map(linha)}</ul>
                </div>
              )}
              {restantes.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    Em dia ({restantes.length})
                  </div>
                  <ul className="divide-y">{restantes.map(linha)}</ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PagamentoManualDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={alvo?.user_id ?? null}
        email={alvo?.email ?? null}
        planoAtual={alvo?.plan_name}
        vencimentoAtual={alvo?.current_period_end ?? null}
      />
    </section>
  );
}
