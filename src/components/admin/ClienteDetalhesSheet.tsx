import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2, IdCard, Mail, Phone, Calendar, LogIn, CreditCard, Activity, Clock,
  Store, Package, Users, FileText, Send, Loader2, MessageCircle, Pencil, CheckCircle2, XCircle, History, Trash2, HandCoins,
} from "lucide-react";
import {
  Cliente, getDiasTrialRestantes, getSaudeCliente, normalizarWhatsAppCliente, PLAN_COLORS,
  MOTIVO_LABEL, MotivoContato,
} from "@/lib/adminHelpers";

import { formatBRL, formatDate } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import PagamentoManualDialog from "./PagamentoManualDialog";

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onContatar: (cliente: Cliente, canal: "whatsapp" | "email") => void;
  onAlterarPlano: (cliente: Cliente) => void;
  onExcluir?: (cliente: Cliente) => void;
}


type Detalhes = {
  last_sign_in_at: string | null;
  telefone: string | null;
  subscription_started_at: string | null;
  current_period_end: string | null;
  subscription_created_at: string | null;
  plan_price_monthly: number | null;
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

type PagamentosCliente = {
  found: boolean;
  total_pago: number;
  faturas_pagas: number;
  ultima_fatura_paga_em: number | null;
  proxima_cobranca_em: number | null;
  proxima_cobranca_valor: number | null;
};

function formatUnix(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}


export default function ClienteDetalhesSheet({ cliente, onClose, onContatar, onAlterarPlano, onExcluir }: Props) {
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const isMobile = useIsMobile();
  const open = !!cliente;

  const { data: detalhes, isLoading } = useQuery({
    queryKey: ["admin-cliente-detalhes", cliente?.user_id],
    queryFn: async () => {
      if (!cliente) return null;
      const { data, error } = await supabase.rpc("admin_get_cliente_detalhes", {
        _user_id: cliente.user_id,
      });
      if (error) throw error;
      return data as unknown as Detalhes;
    },
    enabled: !!cliente,
  });

  const { data: contatos } = useQuery({
    queryKey: ["admin-contatos-cliente", cliente?.user_id],
    queryFn: async () => {
      if (!cliente) return [];
      const { data, error } = await supabase.rpc("admin_get_contatos_cliente", {
        _user_id: cliente.user_id,
        _limit: 10,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string; canal: string; motivo: string; observacao: string | null; created_at: string;
      }>;
    },
    enabled: !!cliente,
  });


  const saude = useMemo(() => (cliente ? getSaudeCliente(cliente) : null), [cliente]);
  const diasTrial = useMemo(() => (cliente ? getDiasTrialRestantes(cliente.trial_end) : null), [cliente]);
  const whatsappOk = useMemo(
    () => normalizarWhatsAppCliente(detalhes?.telefone ?? cliente?.whatsapp ?? null),
    [detalhes?.telefone, cliente?.whatsapp],
  );
  const { data: pagamentos, isLoading: loadingPagamentos, isError: erroPagamentos } = useQuery({
    queryKey: ["admin-cliente-pagamentos", cliente?.email],
    enabled: !!cliente?.email,
    queryFn: async (): Promise<PagamentosCliente> => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/stripe-dados?customer_email=${encodeURIComponent(cliente!.email)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
  });

  const totalPagoLabel = loadingPagamentos
    ? "..."
    : erroPagamentos
      ? "—"
      : !pagamentos?.found || pagamentos.faturas_pagas === 0
        ? "Nenhum pagamento registrado"
        : formatBRL((pagamentos.total_pago || 0) / 100);


  if (!cliente) return null;

  const nome = cliente.loja_principal || cliente.email;
  const telefoneDisplay = detalhes?.telefone || cliente.whatsapp || null;
  const temCotacao = (cliente.total_cotacoes || 0) > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[95vh] w-full p-0 flex flex-col"
            : "w-full sm:max-w-xl p-0 flex flex-col"
        }
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="flex items-start gap-2 text-left">
            <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <span className="truncate">{nome}</span>
          </SheetTitle>
          <SheetDescription className="text-left">
            Perfil completo do cliente
          </SheetDescription>
          {saude && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className={saude.className}>
                {saude.emoji} {saude.label}
              </Badge>
              <Badge variant="outline" className={PLAN_COLORS[cliente.plan_name] || ""}>
                {cliente.plan_name}
                {cliente.plan_status === "trialing" && diasTrial !== null && (
                  <span className="ml-1">· trial {diasTrial}d</span>
                )}
              </Badge>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-5 space-y-6">
            {/* IDENTIFICAÇÃO */}
            <Secao titulo="Identificação">
              <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Loja"
                value={cliente.loja_principal || "—"} />
              <Info icon={<IdCard className="h-3.5 w-3.5" />} label="CNPJ"
                value={cliente.cnpj || "—"} />
              <Info icon={<Mail className="h-3.5 w-3.5" />} label="Email"
                value={cliente.email} breakAll />
              <Info icon={<Phone className="h-3.5 w-3.5" />} label="Telefone"
                value={telefoneDisplay || "—"} />
              <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Cadastro"
                value={formatDateTime(cliente.created_at)} />
              <Info icon={<LogIn className="h-3.5 w-3.5" />} label="Último acesso"
                value={isLoading ? "..." : formatDateTime(detalhes?.last_sign_in_at)} />
            </Secao>

            <Separator />

            {/* PLANO */}
            <Secao titulo="Plano e Status">
              <Info icon={<CreditCard className="h-3.5 w-3.5" />} label="Plano atual"
                value={cliente.plan_name} />
              <Info icon={<Activity className="h-3.5 w-3.5" />} label="Status"
                value={saude?.label || "—"} />
              {cliente.plan_status === "trialing" && (
                <>
                  <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Trial expira"
                    value={formatDate(cliente.trial_end || "")} />
                  <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Dias restantes"
                    value={diasTrial !== null ? `${diasTrial} dia(s)` : "—"} />
                </>
              )}
              <Info icon={<CreditCard className="h-3.5 w-3.5" />} label="Total pago"
                value={totalPagoLabel} />
              {pagamentos?.found && (pagamentos.faturas_pagas || 0) > 0 && (
                <>
                  <Info icon={<FileText className="h-3.5 w-3.5" />} label="Faturas pagas"
                    value={`${pagamentos.faturas_pagas}`} />
                  <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Último pagamento"
                    value={formatUnix(pagamentos.ultima_fatura_paga_em)} />
                </>
              )}
              {pagamentos?.proxima_cobranca_em && (
                <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Próxima cobrança"
                  value={`${formatUnix(pagamentos.proxima_cobranca_em)}${
                    pagamentos.proxima_cobranca_valor
                      ? ` · ${formatBRL(pagamentos.proxima_cobranca_valor / 100)}`
                      : ""
                  }`} />
              )}
            </Secao>

            <Separator />

            {/* USO */}
            <Secao titulo="Uso da Plataforma">
              <Info icon={<Store className="h-3.5 w-3.5" />} label="Lojas"
                value={cliente.total_lojas.toString()} />
              <Info icon={<Package className="h-3.5 w-3.5" />} label="Produtos"
                value={`${cliente.total_produtos}${cliente.total_produtos_inativos > 0 ? ` (+${cliente.total_produtos_inativos} inat.)` : ""}`} />
              <Info icon={<Users className="h-3.5 w-3.5" />} label="Fornecedores"
                value={cliente.total_fornecedores.toString()} />
              <Info icon={<FileText className="h-3.5 w-3.5" />} label="Cotações"
                value={cliente.total_cotacoes.toString()} />
              <Info icon={<Clock className="h-3.5 w-3.5" />} label="Última cotação"
                value={cliente.ultima_cotacao_at ? formatDateTime(cliente.ultima_cotacao_at) : "—"} />
              <Info icon={<Send className="h-3.5 w-3.5" />} label="Pedidos enviados"
                value={cliente.total_pedidos.toString()} />
              <Info
                icon={temCotacao
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                label="Ativado"
                value={temCotacao ? "Sim — já fez cotação" : "Não — sem cotações"}
              />
            </Secao>

            <Separator />

            {/* HISTÓRICO DE CONTATOS */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Histórico de contatos
              </h3>
              {!contatos || contatos.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">
                  Nenhum contato registrado ainda
                </div>
              ) : (
                <ul className="space-y-2">
                  {contatos.map((ct) => (
                    <li
                      key={ct.id}
                      className="flex items-start gap-2 rounded-md border bg-card/50 px-2.5 py-2"
                    >
                      {ct.canal === "whatsapp"
                        ? <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                        : <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />}
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-medium">
                            {formatDateTime(ct.created_at)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {MOTIVO_LABEL[ct.motivo as MotivoContato] || ct.motivo}
                          </Badge>
                        </div>
                        {ct.observacao && (
                          <div className="text-xs text-muted-foreground mt-0.5 break-words">
                            {ct.observacao}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </ScrollArea>

        {/* AÇÕES */}
        <div className="border-t bg-card px-5 py-3 flex flex-wrap gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[120px]"
            onClick={() => onContatar(cliente, "whatsapp")}
            disabled={!whatsappOk}
            title={whatsappOk ? "Enviar WhatsApp" : "Sem número válido"}
          >
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[120px]"
            onClick={() => onContatar(cliente, "email")}
            disabled={!cliente.email}
          >
            <Mail className="h-4 w-4 text-blue-600" />
            Email
          </Button>
          <Button
            size="sm"
            variant="default"
            className="flex-1 min-w-[140px]"
            onClick={() => onAlterarPlano(cliente)}
          >
            <Pencil className="h-4 w-4" />
            Alterar plano
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[180px]"
            onClick={() => setPagamentoOpen(true)}
          >
            <HandCoins className="h-4 w-4 text-primary" />
            Registrar pagamento manual
          </Button>
          {onExcluir && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-w-[140px] text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onExcluir(cliente)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir cliente
            </Button>
          )}
        </div>


        {isLoading && (
          <div className="absolute top-2 right-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </SheetContent>

      <PagamentoManualDialog
        open={pagamentoOpen}
        onOpenChange={setPagamentoOpen}
        userId={cliente.user_id}
        email={cliente.email}
        planoAtual={cliente.plan_name}
        vencimentoAtual={detalhes?.current_period_end ?? cliente.trial_end}
      />
    </Sheet>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {titulo}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Info({
  icon, label, value, breakAll,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card/50 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-sm font-medium mt-1 ${breakAll ? "break-all" : "break-words"}`}>
        {value}
      </div>
    </div>
  );
}
