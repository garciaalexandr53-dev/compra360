import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Wallet, AlertTriangle, CalendarClock, Users, ExternalLink, RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import ResyncAssinaturasButton from "./ResyncAssinaturasButton";
import AssinaturasManuaisSection from "./AssinaturasManuaisSection";


type StripeSubscription = {
  id: string;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  status: string;
  plan_nickname: string | null;
  plan_amount: number;
  plan_currency: string;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
};

type StripeInvoice = {
  id: string;
  number: string | null;
  customer_id: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  created: number;
};

type StripeDadosResponse = {
  summary: {
    recebido_mes: number;
    inadimplente: number;
    proximas_cobrancas_30d: number;
    assinaturas_ativas: number;
    currency: string;
  };
  subscriptions: StripeSubscription[];
  invoices: StripeInvoice[];
};

function formatCents(cents: number, currency = "brl") {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}

function subStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Ativo", variant: "default" },
    trialing: { label: "Trial", variant: "secondary" },
    past_due: { label: "Inadimplente", variant: "destructive" },
    unpaid: { label: "Inadimplente", variant: "destructive" },
    canceled: { label: "Cancelado", variant: "outline" },
    incomplete: { label: "Incompleto", variant: "outline" },
    incomplete_expired: { label: "Expirado", variant: "outline" },
    paused: { label: "Pausado", variant: "outline" },
  };
  const m = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function invStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    paid: { label: "Paga", variant: "default" },
    open: { label: "Pendente", variant: "secondary" },
    uncollectible: { label: "Falha", variant: "destructive" },
    void: { label: "Anulada", variant: "outline" },
    draft: { label: "Rascunho", variant: "outline" },
  };
  const m = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default function PagamentosTab() {
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["stripe-dados", periodo],
    queryFn: async (): Promise<StripeDadosResponse> => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/stripe-dados?invoices_days=${periodo}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
      }
      return resp.json();
    },
  });

  const filteredSubs = useMemo(() => {
    const subs = data?.subscriptions || [];
    if (statusFilter === "todos") return subs;
    if (statusFilter === "ativo") return subs.filter((s) => s.status === "active" || s.status === "trialing");
    if (statusFilter === "inadimplente") return subs.filter((s) => s.status === "past_due" || s.status === "unpaid");
    if (statusFilter === "cancelado") return subs.filter((s) => s.status === "canceled");
    return subs;
  }, [data, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <AssinaturasManuaisSection />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">
              Erro ao consultar Stripe: {error instanceof Error ? error.message : "desconhecido"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
        <AssinaturasManuaisSection />
      </div>
    );
  }

  const summary = data!.summary;
  const subs = data!.subscriptions;
  const invoices = data!.invoices;
  const isEmpty = subs.length === 0 && invoices.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Dados vindos direto do Stripe. Use a re-sincronização para corrigir divergências no banco.
        </p>
        <ResyncAssinaturasButton />
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="💰 Recebido este mês"
          value={formatCents(summary.recebido_mes, summary.currency)}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="⚠️ Inadimplente"
          value={formatCents(summary.inadimplente, summary.currency)}
          danger={summary.inadimplente > 0}
        />
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="📅 Próximas cobranças (30d)"
          value={formatCents(summary.proximas_cobrancas_30d, summary.currency)}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="👥 Assinaturas ativas"
          value={summary.assinaturas_ativas.toString()}
        />
      </div>

      <AssinaturasManuaisSection />

      {isEmpty ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma assinatura encontrada. Os dados aparecem aqui após o primeiro pagamento real.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Assinaturas */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Assinaturas ({filteredSubs.length})
              </h2>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-2 font-medium">Cliente</th>
                        <th className="px-4 py-2 font-medium">Plano</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Próxima cobrança</th>
                        <th className="px-4 py-2 font-medium text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((s) => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium truncate max-w-[220px]">
                              {s.customer_name || s.customer_email || s.customer_id}
                            </div>
                            {s.customer_email && s.customer_name && (
                              <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                                {s.customer_email}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">{s.plan_nickname || "—"}</td>
                          <td className="px-4 py-3">{subStatusBadge(s.status)}</td>
                          <td className="px-4 py-3">
                            {s.current_period_end
                              ? formatDate(new Date(s.current_period_end * 1000).toISOString())
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCents(s.plan_amount, s.plan_currency)}
                          </td>
                        </tr>
                      ))}
                      {filteredSubs.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhuma assinatura com este filtro.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Mobile */}
                <ul className="md:hidden divide-y">
                  {filteredSubs.map((s) => (
                    <li key={s.id} className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {s.customer_name || s.customer_email || s.customer_id}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.plan_nickname || "Plano"} · {s.customer_email}
                          </div>
                        </div>
                        {subStatusBadge(s.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {s.current_period_end
                            ? formatDate(new Date(s.current_period_end * 1000).toISOString())
                            : "—"}
                        </span>
                        <span className="font-semibold">{formatCents(s.plan_amount, s.plan_currency)}</span>
                      </div>
                    </li>
                  ))}
                  {filteredSubs.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma assinatura com este filtro.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Faturas */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Faturas recentes ({invoices.length})
              </h2>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as "7" | "30" | "90")}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-2 font-medium">Cliente</th>
                        <th className="px-4 py-2 font-medium text-right">Valor</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Data</th>
                        <th className="px-4 py-2 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((i) => (
                        <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="truncate max-w-[220px]">
                              {i.customer_name || i.customer_email || i.customer_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCents(i.status === "paid" ? i.amount_paid : i.amount_due, i.currency)}
                          </td>
                          <td className="px-4 py-3">{invStatusBadge(i.status)}</td>
                          <td className="px-4 py-3">{formatDate(new Date(i.created * 1000).toISOString())}</td>
                          <td className="px-4 py-3 text-right">
                            {i.hosted_invoice_url ? (
                              <a
                                href={i.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Ver no Stripe <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhuma fatura no período.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden divide-y">
                  {invoices.map((i) => (
                    <li key={i.id} className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {i.customer_name || i.customer_email || i.customer_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(new Date(i.created * 1000).toISOString())}
                          </div>
                        </div>
                        {invStatusBadge(i.status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          {formatCents(i.status === "paid" ? i.amount_paid : i.amount_due, i.currency)}
                        </span>
                        {i.hosted_invoice_url && (
                          <a
                            href={i.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary"
                          >
                            Ver no Stripe <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                  {invoices.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma fatura no período.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-destructive/40 bg-destructive/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className={`text-xl sm:text-2xl font-bold ${danger ? "text-destructive" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
