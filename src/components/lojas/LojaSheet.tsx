import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Package,
  Building2,
  ClipboardList,
  Clock,
  Pencil,
  Trash2,
  FolderArchive,
  ListChecks,
  Check,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loja, LojaMetrics, getDisplayName, isLojaAtiva } from "./lojaUtils";
import { toast } from "sonner";

interface Props {
  loja: Loja | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ativaId: string | null;
  metrics: LojaMetrics | undefined;
  loadingMetrics: boolean;
  onActivate: (id: string) => void;
  onEdit: (loja: Loja) => void;
  onDelete: (loja: Loja) => void;
}

export default function LojaSheet({
  loja,
  open,
  onOpenChange,
  ativaId,
  metrics,
  loadingMetrics,
  onActivate,
  onEdit,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!loja) return null;

  const ativa = isLojaAtiva(loja.id, ativaId);
  const display = getDisplayName(loja);

  const ensureActive = () => {
    if (!ativa) onActivate(loja.id);
  };

  const goProdutos = () => {
    ensureActive();
    onOpenChange(false);
    navigate("/produtos");
  };
  const goFornecedores = () => {
    ensureActive();
    onOpenChange(false);
    navigate("/fornecedores");
  };
  const goHistorico = () => {
    ensureActive();
    onOpenChange(false);
    navigate("/historico");
  };
  const goUltimaCotacao = () => {
    ensureActive();
    onOpenChange(false);
    if (metrics?.ultimaCotacaoId) {
      navigate(`/cotacao?id=${metrics.ultimaCotacaoId}`);
    } else {
      toast.info("Nenhuma cotação registrada ainda.");
      navigate("/historico");
    }
  };
  const goCotacaoAtiva = () => {
    ensureActive();
    onOpenChange(false);
    if (metrics?.cotacaoAtivaId) {
      navigate(`/cotacao?id=${metrics.cotacaoAtivaId}`);
    } else {
      toast.info("Sem cotação ativa nesta loja.");
      navigate("/dashboard");
    }
  };

  const ultima = metrics?.ultimaCotacaoAt
    ? formatDistanceToNow(new Date(metrics.ultimaCotacaoAt), { locale: ptBR, addSuffix: true })
    : "—";

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setConfirmDelete(false); }}>
      <SheetContent
        side="bottom"
        className="h-[92vh] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:mx-auto sm:rounded-t-2xl overflow-y-auto p-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 text-left border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold leading-tight break-words">
                {display}
              </SheetTitle>
              {loja.razao_social && (
                <p className="text-sm text-muted-foreground mt-0.5">{loja.razao_social}</p>
              )}
            </div>
            {ativa ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-success text-success-foreground rounded-full shrink-0">
                <Check className="h-3 w-3" /> ATIVA
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-success text-success hover:bg-success/10 shrink-0"
                onClick={() => onActivate(loja.id)}
              >
                Ativar loja
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="px-5 py-4 space-y-5">
          {/* Dados cadastrais */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Dados cadastrais
            </h4>
            <div className="space-y-1.5 text-sm">
              <DataRow label="Razão Social" value={loja.razao_social} />
              <DataRow label="CNPJ" value={loja.cnpj} />
              <DataRow label="Insc. Estadual" value={loja.inscricao_estadual} />
              <DataRow label="Endereço" value={loja.endereco} />
            </div>
          </section>

          {/* Métricas */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Métricas — toque para navegar
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Package className="h-4 w-4" />}
                label="Produtos ativos"
                value={loadingMetrics ? "…" : String(metrics?.produtosAtivos ?? 0)}
                tone="primary"
                onClick={goProdutos}
              />
              <MetricCard
                icon={<Building2 className="h-4 w-4" />}
                label="Fornecedores"
                value={loadingMetrics ? "…" : String(metrics?.fornecedoresVinculados ?? 0)}
                tone="primary"
                onClick={goFornecedores}
              />
              <MetricCard
                icon={<ClipboardList className="h-4 w-4" />}
                label="Cotações do mês"
                value={loadingMetrics ? "…" : String(metrics?.cotacoesMes ?? 0)}
                tone="warning"
                onClick={goHistorico}
              />
              <MetricCard
                icon={<Clock className="h-4 w-4" />}
                label="Última cotação"
                value={loadingMetrics ? "…" : ultima}
                tone="muted"
                onClick={goUltimaCotacao}
              />
            </div>
          </section>

          {/* Ações rápidas */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-2">
              Ações rápidas
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button variant="outline" size="sm" className="h-auto py-2 flex-col gap-1" onClick={() => onEdit(loja)}>
                <Pencil className="h-4 w-4" />
                <span className="text-[11px]">Editar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-2 flex-col gap-1"
                onClick={goCotacaoAtiva}
                disabled={!metrics?.cotacaoAtivaId}
                title={metrics?.cotacaoAtivaId ? "Abrir cotação ativa" : "Sem cotação ativa"}
              >
                <ListChecks className="h-4 w-4" />
                <span className="text-[11px]">{metrics?.cotacaoAtivaId ? "Cotação ativa" : "Sem ativa"}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-auto py-2 flex-col gap-1" onClick={goHistorico}>
                <FolderArchive className="h-4 w-4" />
                <span className="text-[11px]">Histórico</span>
              </Button>
              {confirmDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-auto py-2 flex-col gap-1"
                  onClick={() => {
                    onDelete(loja);
                    setConfirmDelete(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-[11px]">Confirmar?</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 flex-col gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-[11px]">Excluir</span>
                </Button>
              )}
            </div>
            {confirmDelete && (
              <p className="text-[11px] text-destructive mt-2 text-center">
                Toque novamente para confirmar a exclusão de "{display}".
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1 break-words">{value || "—"}</span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "warning" | "muted";
  onClick: () => void;
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary border-primary/20 hover:border-primary/50 hover:bg-primary/5"
      : tone === "warning"
      ? "text-warning border-warning/20 hover:border-warning/50 hover:bg-warning/5"
      : "text-muted-foreground border-border hover:border-foreground/30 hover:bg-muted/40";
  return (
    <button
      onClick={onClick}
      className={`group text-left bg-card rounded-lg p-3 border transition-all ${toneCls}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-base font-bold text-foreground mt-1 truncate">{value}</div>
      <div className="text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        Toque para abrir <ArrowRight className="h-2.5 w-2.5" />
      </div>
    </button>
  );
}
