import { Package, Building2, ClipboardList, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loja, LojaMetrics, getDisplayName, isLojaAtiva } from "./lojaUtils";

interface Props {
  loja: Loja;
  ativaId: string | null;
  metrics: LojaMetrics | undefined;
  loadingMetrics: boolean;
  onClick: () => void;
}

export default function LojaCard({ loja, ativaId, metrics, loadingMetrics, onClick }: Props) {
  const ativa = isLojaAtiva(loja.id, ativaId);
  const display = getDisplayName(loja);
  const ultima = metrics?.ultimaCotacaoAt
    ? formatDistanceToNow(new Date(metrics.ultimaCotacaoAt), { locale: ptBR, addSuffix: false })
    : "—";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 shadow-sm transition-all border ${
        ativa
          ? "bg-success/5 border-success/40 shadow-success/10 hover:shadow-md"
          : "bg-card border-border hover:shadow-md hover:border-primary/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-foreground text-base leading-tight break-words">
              {display}
            </h3>
            {ativa && (
              <span className="text-[10px] px-2 py-0.5 bg-success text-success-foreground rounded-full font-bold shrink-0">
                ATIVA
              </span>
            )}
          </div>
          {loja.razao_social && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{loja.razao_social}</p>
          )}
          {(loja.cnpj || loja.endereco) && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
              {[loja.cnpj, loja.endereco].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Métricas 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<Package className="h-3.5 w-3.5" />}
          label="Produtos"
          value={loadingMetrics ? "…" : String(metrics?.produtosAtivos ?? 0)}
          tone="primary"
        />
        <Metric
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Fornecedores"
          value={loadingMetrics ? "…" : String(metrics?.fornecedoresVinculados ?? 0)}
          tone="primary"
        />
        <Metric
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="Cotações/mês"
          value={loadingMetrics ? "…" : String(metrics?.cotacoesMes ?? 0)}
          tone="warning"
        />
        <Metric
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Última cotação"
          value={loadingMetrics ? "…" : ultima}
          tone="muted"
        />
      </div>
    </button>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "warning" | "muted";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
      ? "text-warning"
      : "text-muted-foreground";
  return (
    <div className="bg-background/60 dark:bg-background/30 rounded-lg p-2 border border-border/60">
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${toneCls}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-bold text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}
