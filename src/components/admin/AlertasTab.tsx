import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, TimerReset, UserPlus, MessageCircle, Mail, CheckCircle2, XCircle, Download,
} from "lucide-react";
import {
  Cliente, getDiasTrialRestantes, getDiasSemUso, getDiasDesdeCadastro, getSaudeCliente,
  SituacaoCliente,
} from "@/lib/adminHelpers";
import { formatDate } from "@/lib/format";
import {
  buildAlertasCsv, downloadCsv, alertasTrialsFilename, alertasChurnFilename,
} from "@/lib/adminExports";

interface Props {
  clientes: Cliente[];
  onContatar: (c: Cliente, situacao: SituacaoCliente, canal: "whatsapp" | "email") => void;
}

export default function AlertasTab({ clientes, onContatar }: Props) {
  const trialsExpirando = useMemo(() => {
    return clientes
      .filter((c) => {
        if (c.plan_status !== "trialing") return false;
        const dias = getDiasTrialRestantes(c.trial_end);
        return dias !== null && dias <= 7;
      })
      .sort((a, b) => (getDiasTrialRestantes(a.trial_end) ?? 99) - (getDiasTrialRestantes(b.trial_end) ?? 99));
  }, [clientes]);

  const emRiscoChurn = useMemo(() => {
    return clientes
      .filter((c) => {
        const saude = getSaudeCliente(c);
        return saude.status === "risco" || saude.status === "dormindo";
      })
      .sort((a, b) => {
        const da = getDiasSemUso(a) ?? 0;
        const db = getDiasSemUso(b) ?? 0;
        return db - da;
      });
  }, [clientes]);

  const novosSemana = useMemo(() => {
    return clientes
      .filter((c) => getDiasDesdeCadastro(c) <= 7)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [clientes]);

  return (
    <div className="space-y-6">
      {/* Trials expirando */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Trials expirando (≤7 dias)
          <Badge variant="outline" className="ml-1">{trialsExpirando.length}</Badge>
        </h2>
        {trialsExpirando.length === 0 ? (
          <EmptyState texto="Nenhum trial expirando esta semana 🎉" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {trialsExpirando.map((c) => {
              const dias = getDiasTrialRestantes(c.trial_end) ?? 0;
              const urgente = dias <= 3;
              const situacao: SituacaoCliente = urgente ? "trial_3d" : "trial_7d";
              return (
                <Card key={c.user_id} className={urgente ? "border-destructive/40" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{c.loja_principal || c.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={urgente
                          ? "bg-destructive/15 text-destructive border-destructive/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"}
                      >
                        <TimerReset className="h-3 w-3 mr-1" />
                        {dias}d
                      </Badge>
                    </div>
                    <ContatoBotoes c={c} situacao={situacao} onContatar={onContatar} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Em risco de churn */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="text-amber-500">🟡</span>
          Sem atividade — risco de churn
          <Badge variant="outline" className="ml-1">{emRiscoChurn.length}</Badge>
        </h2>
        {emRiscoChurn.length === 0 ? (
          <EmptyState texto="Todos os clientes estão ativos 🚀" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {emRiscoChurn.map((c) => {
              const dias = getDiasSemUso(c);
              const diasCadastro = getDiasDesdeCadastro(c);
              const inativo = dias !== null && dias > 15;
              const situacao: SituacaoCliente = inativo ? "inativo_15d" : "sem_uso_7d";
              return (
                <Card key={c.user_id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{c.loja_principal || c.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        {dias !== null ? `${dias}d sem uso` : `${diasCadastro}d sem cotar`}
                      </Badge>
                    </div>
                    <ContatoBotoes c={c} situacao={situacao} onContatar={onContatar} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Novos esta semana */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          Novos esta semana
          <Badge variant="outline" className="ml-1">{novosSemana.length}</Badge>
        </h2>
        {novosSemana.length === 0 ? (
          <EmptyState texto="Nenhum cadastro nos últimos 7 dias." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {novosSemana.map((c) => (
              <Card key={c.user_id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.loja_principal || c.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Cadastro: {formatDate(c.created_at)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs mb-2">
                    <ChecklistItem ok={c.total_lojas > 0} label="Loja" />
                    <ChecklistItem ok={c.total_produtos > 0} label="Produtos" />
                    <ChecklistItem ok={c.total_fornecedores > 0} label="Fornecedor" />
                    <ChecklistItem ok={c.total_cotacoes > 0} label="1ª cotação" />
                  </div>
                  <ContatoBotoes c={c} situacao="boas_vindas" onContatar={onContatar} apenasWhats />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

function ContatoBotoes({
  c, situacao, onContatar, apenasWhats,
}: {
  c: Cliente;
  situacao: SituacaoCliente;
  onContatar: (c: Cliente, situacao: SituacaoCliente, canal: "whatsapp" | "email") => void;
  apenasWhats?: boolean;
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
        onClick={() => onContatar(c, situacao, "whatsapp")}
      >
        <MessageCircle className="h-3 w-3" />
        WhatsApp
      </Button>
      {!apenasWhats && c.email && (
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1"
          onClick={() => onContatar(c, situacao, "email")}
        >
          <Mail className="h-3 w-3" />
          Email
        </Button>
      )}
    </div>
  );
}

function EmptyState({ texto }: { texto: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-center text-sm text-muted-foreground">{texto}</CardContent>
    </Card>
  );
}
