import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  acaoLabel,
  ENVIO_ORIGEM,
  origemLabel,
  type EnvioAcao,
} from "@/lib/envioStatus";
import { fetchHistoricoEnvios } from "@/lib/envioFornecedor";
import StatusEnvioBadge from "./StatusEnvioBadge";
import { Clock, Bot, User as UserIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string | null;
  fornecedorId: string | null;
  fornecedorNome?: string;
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const acaoBadgeClass: Record<EnvioAcao, string> = {
  envio_inicial: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900",
  reenvio: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900",
  atualizacao_status: "bg-muted text-muted-foreground border-border",
};

const HistoricoEnviosSheet = ({ open, onOpenChange, cotacaoId, fornecedorId, fornecedorNome }: Props) => {
  const enabled = open && !!cotacaoId && !!fornecedorId;
  const { data, isLoading } = useQuery({
    queryKey: ["historico-envios", cotacaoId, fornecedorId],
    enabled,
    queryFn: () => fetchHistoricoEnvios(cotacaoId!, fornecedorId!),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base sm:text-lg">
            Histórico de envios
            {fornecedorNome && (
              <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                {fornecedorNome}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {isLoading && (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando…</div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum envio registrado ainda.
            </div>
          )}
          {!isLoading && data && data.length > 0 && (
            <ol className="space-y-3">
              {data.map((row) => {
                const isApi = row.origem === ENVIO_ORIGEM.AUTOMATICA;
                return (
                  <li
                    key={row.id}
                    className="border rounded-lg p-3 bg-card flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${acaoBadgeClass[row.acao]}`}
                      >
                        {acaoLabel[row.acao]}
                      </span>
                      <StatusEnvioBadge status={row.status} />
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border-border"
                        title={origemLabel[row.origem]}
                      >
                        {isApi ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                        {isApi ? "API" : "Manual"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(row.created_at)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HistoricoEnviosSheet;
