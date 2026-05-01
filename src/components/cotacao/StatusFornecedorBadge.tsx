import { CheckCircle2, Eye, EyeOff } from "lucide-react";

export type FornecedorVisualStatus = "respondeu" | "visualizou" | "nao_visualizou";

interface Props {
  status: FornecedorVisualStatus;
  /** Compact mode for tables/dense lists */
  compact?: boolean;
}

const cfg: Record<FornecedorVisualStatus, { icon: typeof Eye; label: string; cls: string }> = {
  respondeu: {
    icon: CheckCircle2,
    label: "Respondeu",
    cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900",
  },
  visualizou: {
    icon: Eye,
    label: "Visualizou",
    cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900",
  },
  nao_visualizou: {
    icon: EyeOff,
    label: "Não abriu",
    cls: "bg-muted text-muted-foreground border-border",
  },
};

const StatusFornecedorBadge = ({ status, compact }: Props) => {
  const { icon: Icon, label, cls } = cfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
      title={label}
    >
      <Icon className="h-3 w-3" />
      {!compact && <span>{label}</span>}
    </span>
  );
};

export default StatusFornecedorBadge;
