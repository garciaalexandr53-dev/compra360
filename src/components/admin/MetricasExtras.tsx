import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { TrendingUp, AlertTriangle, Users, LineChart as LineChartIcon } from "lucide-react";
import { Cliente } from "@/lib/adminHelpers";
import { PLAN_PRICE_NUMERIC, PLAN_PRICES } from "@/lib/planPrices";
import { formatBRL } from "@/lib/format";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  business: "Business",
  pro: "Pro",
};

interface PlanBreakdown {
  plan: string;
  count: number;
  price: number;
  total: number;
}

function buildBreakdown(clientes: Cliente[]): PlanBreakdown[] {
  const counts: Record<string, number> = {};
  clientes.forEach((c) => {
    if (c.plan_status !== "active") return;
    counts[c.plan_name] = (counts[c.plan_name] || 0) + 1;
  });
  return Object.keys(counts).map((plan) => {
    const price = PLAN_PRICE_NUMERIC[plan] ?? 0;
    const count = counts[plan];
    return { plan, count, price, total: count * price };
  }).sort((a, b) => b.total - a.total);
}

export function MrrBreakdownCard({ clientes, onOpenMrr }: { clientes: Cliente[]; onOpenMrr?: () => void }) {
  const breakdown = useMemo(() => buildBreakdown(clientes), [clientes]);
  const mrr = useMemo(() => breakdown.reduce((s, b) => s + b.total, 0), [breakdown]);

  const trials = useMemo(() => clientes.filter((c) => c.plan_status === "trialing"), [clientes]);
  const trialPotencial = useMemo(
    () => trials.reduce((s, c) => s + (PLAN_PRICE_NUMERIC[c.plan_name] ?? PLAN_PRICES.business.monthly), 0),
    [trials]
  );

  return (
    <Card
      className="border-primary/40 bg-primary/5 cursor-pointer hover:shadow-sm transition-all"
      onClick={onOpenMrr}
    >
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span>MRR estimado</span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-primary">{formatBRL(mrr)}</div>
        </div>

        <div className="space-y-1.5">
          {(["free", "business", "pro"] as const).map((plan) => {
            const row = breakdown.find((b) => b.plan === plan) ?? {
              plan, count: 0, price: PLAN_PRICE_NUMERIC[plan] ?? 0, total: 0,
            };
            return (
              <div key={plan} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                <span className="text-muted-foreground truncate">
                  {PLAN_LABELS[plan]}: {row.count} {row.count === 1 ? "cliente" : "clientes"} × {formatBRL(row.price)}
                </span>
                <span className="font-semibold tabular-nums shrink-0">{formatBRL(row.total)}</span>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-primary/20 space-y-1 text-xs sm:text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate">
              {trials.length} {trials.length === 1 ? "trial ativo" : "trials ativos"} (não contam no MRR)
            </span>
            <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
              potencial {formatBRL(trialPotencial)}
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground">
            Se todos os trials converterem: <span className="font-semibold text-foreground">{formatBRL(mrr + trialPotencial)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChurnRiskCard({ clientes, onClick }: { clientes: Cliente[]; onClick?: () => void }) {
  const { count, receita } = useMemo(() => {
    const now = Date.now();
    const limite = 15 * 86400000;
    let c = 0;
    let r = 0;
    clientes.forEach((cli) => {
      if (!cli.ultima_cotacao_at) return;
      const dias = now - new Date(cli.ultima_cotacao_at).getTime();
      if (dias > limite) {
        c += 1;
        if (cli.plan_status === "active") {
          r += PLAN_PRICE_NUMERIC[cli.plan_name] ?? 0;
        }
      }
    });
    return { count: c, receita: r };
  }, [clientes]);

  const danger = count > 0;

  return (
    <Card
      onClick={onClick}
      className={[
        danger ? "border-destructive/40 bg-destructive/5" : "",
        onClick ? "cursor-pointer hover:border-destructive/60 hover:shadow-sm transition-all" : "",
      ].filter(Boolean).join(" ")}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <AlertTriangle className="h-4 w-4" />
          <span className="truncate">Em risco de churn</span>
        </div>
        <div className={`text-2xl font-bold ${danger ? "text-destructive" : ""}`}>
          {count} {count === 1 ? "cliente" : "clientes"}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {receita > 0 ? `${formatBRL(receita)} em risco` : "sem receita em risco"}
        </div>
      </CardContent>
    </Card>
  );
}

interface WeekPoint {
  semana: string;
  total: number;
}

export function buildGrowthData(clientes: Cliente[], weeks = 8, now: Date = new Date()): WeekPoint[] {
  // End-of-week (sunday 23:59) anchor for "now"
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const cutoff = new Date(end);
    cutoff.setDate(cutoff.getDate() - i * 7);
    const cutoffMs = cutoff.getTime();
    const total = clientes.filter((c) => new Date(c.created_at).getTime() <= cutoffMs).length;
    points.push({ semana: `Sem ${weeks - i}`, total });
  }
  return points;
}

export function GrowthChart({ clientes }: { clientes: Cliente[] }) {
  const data = useMemo(() => buildGrowthData(clientes), [clientes]);
  const max = data.reduce((m, d) => Math.max(m, d.total), 0);
  const min = data.reduce((m, d) => Math.min(m, d.total), max);
  const delta = max - min;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LineChartIcon className="h-4 w-4" />
            <span>Crescimento de usuários (últimas 8 semanas)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{max}</span>
            <span className="text-muted-foreground">total</span>
            {delta > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                +{delta} no período
              </span>
            )}
          </div>
        </div>
        <div className="h-48 sm:h-56 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [`${v} usuários`, "Total"]}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
