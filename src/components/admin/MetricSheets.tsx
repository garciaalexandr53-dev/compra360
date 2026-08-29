import { useMemo } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cliente, getDiasTrialRestantes, getSaudeCliente, PLAN_COLORS, getNomeExibicao } from "@/lib/adminHelpers";
import { PLAN_PRICE_NUMERIC, formatPrice } from "@/lib/planPrices";
import { formatBRL, formatDate } from "@/lib/format";
import { MessageCircle, Mail } from "lucide-react";

export type SheetType =
  | null
  | "mrr"
  | "trials"
  | "free"
  | "pagantes"
  | "todos"
  | "novos7"
  | "novos30"
  | "lojas"
  | "produtos"
  | "fornecedores"
  | "cotacoes"
  | "pedidos";

interface Props {
  type: SheetType;
  clientes: Cliente[];
  metrics: any;
  onClose: () => void;
  onContatar: (c: Cliente) => void;
}

export default function MetricSheets({ type, clientes, metrics, onClose, onContatar }: Props) {
  const open = !!type;

  const titulo = useMemo(() => {
    switch (type) {
      case "mrr": return "Receita — clientes pagantes";
      case "trials": return "Trials ativos";
      case "free": return "Clientes plano Free";
      case "pagantes": return "Clientes Pro / Business";
      case "todos": return "Todos os clientes";
      case "novos7": return "Novos esta semana";
      case "novos30": return "Novos este mês";
      case "lojas": return "Todas as lojas";
      case "produtos": return "Produtos por cliente";
      case "fornecedores": return "Fornecedores por cliente";
      case "cotacoes": return "Cotações";
      case "pedidos": return "Pedidos";
      default: return "";
    }
  }, [type]);

  const lista = useMemo<Cliente[]>(() => {
    if (!type) return [];
    const now = Date.now();

    // Deduplicação defensiva por user_id (mantém o registro com mais cotações)
    const dedupMap = new Map<string, Cliente>();
    clientes.forEach((c) => {
      const existing = dedupMap.get(c.user_id);
      if (!existing || (c.total_cotacoes || 0) > (existing.total_cotacoes || 0)) {
        dedupMap.set(c.user_id, c);
      }
    });
    const unicos = Array.from(dedupMap.values());

    switch (type) {
      case "mrr":
      case "pagantes":
        return unicos.filter((c) => c.plan_name === "pro" || c.plan_name === "business");
      case "trials":
        return unicos
          .filter((c) => c.plan_status === "trialing")
          .sort((a, b) => (getDiasTrialRestantes(a.trial_end) ?? 99) - (getDiasTrialRestantes(b.trial_end) ?? 99));
      case "free":
        return unicos.filter((c) => c.plan_name === "free");
      case "todos":
        return unicos;
      case "novos7":
        return unicos.filter((c) => now - new Date(c.created_at).getTime() <= 7 * 86400000);
      case "novos30":
        return unicos.filter((c) => now - new Date(c.created_at).getTime() <= 30 * 86400000);
      case "lojas":
        return unicos.filter((c) => c.total_lojas > 0);
      case "produtos":
        return [...unicos].sort((a, b) => b.total_produtos - a.total_produtos).filter((c) => c.total_produtos > 0);
      case "fornecedores":
        return [...unicos].sort((a, b) => b.total_fornecedores - a.total_fornecedores).filter((c) => c.total_fornecedores > 0);
      case "cotacoes":
        return [...unicos].sort((a, b) => b.total_cotacoes - a.total_cotacoes).filter((c) => c.total_cotacoes > 0);
      case "pedidos":
        return [...unicos].sort((a, b) => b.total_pedidos - a.total_pedidos).filter((c) => c.total_pedidos > 0);
      default: return [];
    }
  }, [type, clientes]);

  const subtitulo = useMemo(() => {
    if (type === "mrr") {
      const mrr = lista.reduce((s, c) => s + (PLAN_PRICE_NUMERIC[c.plan_name] || 0), 0);
      return `MRR estimado: ${formatBRL(mrr)}`;
    }
    return `${lista.length} ${lista.length === 1 ? "cliente" : "clientes"}`;
  }, [type, lista]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{subtitulo}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-3">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum cliente nesta categoria.</p>
          ) : (
            <div className="space-y-2 pb-6">
              {lista.map((c) => (
                <ClienteRow
                  key={c.user_id}
                  cliente={c}
                  type={type!}
                  onContatar={onContatar}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ClienteRow({
  cliente, type, onContatar,
}: {
  cliente: Cliente;
  type: NonNullable<SheetType>;
  onContatar: (c: Cliente) => void;
}) {
  const saude = getSaudeCliente(cliente);
  const diasTrial = getDiasTrialRestantes(cliente.trial_end);
  const valorMensal = PLAN_PRICE_NUMERIC[cliente.plan_name] || 0;

  // Conteúdo direito específico por tipo
  const renderRight = () => {
    switch (type) {
      case "mrr":
      case "pagantes":
        return <div className="text-right text-sm font-semibold text-primary">{formatBRL(valorMensal)}/mês</div>;
      case "trials":
        return (
          <Badge
            variant="outline"
            className={diasTrial !== null && diasTrial <= 3
              ? "bg-destructive/15 text-destructive border-destructive/30"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"}
          >
            {diasTrial !== null ? `${diasTrial}d restantes` : "—"}
          </Badge>
        );
      case "produtos":
        return <div className="text-right text-sm font-semibold">{cliente.total_produtos} produtos</div>;
      case "fornecedores":
        return <div className="text-right text-sm font-semibold">{cliente.total_fornecedores} forn.</div>;
      case "cotacoes":
        return <div className="text-right text-sm font-semibold">{cliente.total_cotacoes} cot.</div>;
      case "pedidos":
        return <div className="text-right text-sm font-semibold">{cliente.total_pedidos} ped.</div>;
      case "lojas":
        return <div className="text-right text-xs text-muted-foreground">{cliente.cnpj || "Sem CNPJ"}</div>;
      case "novos7":
      case "novos30":
        return (
          <div className="text-right text-xs space-y-0.5">
            <div className={cliente.total_lojas > 0 ? "text-emerald-600" : "text-muted-foreground"}>
              {cliente.total_lojas > 0 ? "✅" : "❌"} Loja
            </div>
            <div className={cliente.total_produtos > 0 ? "text-emerald-600" : "text-muted-foreground"}>
              {cliente.total_produtos > 0 ? "✅" : "❌"} Produto
            </div>
            <div className={cliente.total_cotacoes > 0 ? "text-emerald-600" : "text-muted-foreground"}>
              {cliente.total_cotacoes > 0 ? "✅" : "❌"} Cotação
            </div>
          </div>
        );
      case "todos":
        return (
          <div className="text-right">
            <Badge variant="outline" className={saude.className}>{saude.emoji} {saude.label}</Badge>
            {cliente.ultima_cotacao_at && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Últ.: {formatDate(cliente.ultima_cotacao_at)}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{getNomeExibicao(cliente)}</div>
        <div className="text-xs text-muted-foreground truncate">
          {cliente.nome_contato && cliente.loja_principal ? `${cliente.loja_principal} · ${cliente.email}` : cliente.email}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${PLAN_COLORS[cliente.plan_name] || ""}`}>
            {cliente.plan_name}{cliente.plan_status === "trialing" && " (trial)"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            Cadastro: {formatDate(cliente.created_at)}
          </span>
        </div>
        <div className="flex gap-1 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => onContatar(cliente)}
          >
            <MessageCircle className="h-3 w-3 text-emerald-600" />
            Contatar
          </Button>
          {cliente.email && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => onContatar(cliente)}
            >
              <Mail className="h-3 w-3 text-blue-600" />
              Email
            </Button>
          )}
        </div>
      </div>
      <div className="shrink-0">{renderRight()}</div>
    </div>
  );
}
