import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { classificarDesempenho } from "@/lib/desempenhoFornecedor";

interface Props {
  total?: number | null;
  respondidas?: number | null;
  tempoHoras?: number | null;
}

const tomCls = {
  novo: "text-muted-foreground",
  positivo: "text-primary",
  atencao: "text-amber-600 dark:text-amber-400",
  neutro: "text-muted-foreground",
} as const;

export default function DesempenhoFornecedorBadge({ total, respondidas, tempoHoras }: Props) {
  const d = classificarDesempenho(total, respondidas, tempoHoras);
  const Icon = d.tom === "novo" ? Sparkles : CheckCircle2;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium">
      <span className={`inline-flex items-center gap-1 ${tomCls[d.tom]}`}>
        <Icon className="h-3 w-3" /> {d.texto}
      </span>
      {d.agil && (
        <span className="inline-flex items-center gap-1 text-primary">
          <Zap className="h-3 w-3" /> Responde no mesmo dia
        </span>
      )}
    </div>
  );
}
