import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, Copy, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import { formatTelefone, formatNomeEmpresa, formatNomePessoa } from "@/lib/masks";
import { linkParceiro, mensagemLinkParceiro } from "@/lib/parceiro";

export type SolicitacaoAcesso = {
  id: string;
  fornecedor_id: string;
  nome: string;
  representante: string | null;
  telefone: string | null;
  cnpj: string | null;
  token: string;
  codigo: string;
  finalidade: string;
  expira_em: string;
  confirmado_em: string | null;
  created_at: string;
};

/** Texto amigável do motivo da solicitação. */
export function motivoLabel(finalidade: string): string {
  return finalidade === "cadastro" ? "Novo cadastro na Rede" : "Atualização de dados";
}

/** "Há 3 minutos", "Hoje às 18:48" ou a data completa. */
export function quandoLabel(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const min = Math.floor((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "Agora mesmo";
  if (min < 60) return `Há ${min} minuto${min === 1 ? "" : "s"}`;
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === agora.toDateString()) return `Hoje às ${hora}`;
  return formatDateTime(iso);
}

/** Filtra por código, empresa, representante ou telefone. */
export function filtrarSolicitacoes(
  itens: SolicitacaoAcesso[],
  termo: string,
): SolicitacaoAcesso[] {
  const t = termo.trim().toLowerCase();
  if (!t) return itens;
  const digitos = t.replace(/\D/g, "");
  return itens.filter(
    (s) =>
      s.codigo.includes(t) ||
      (s.nome || "").toLowerCase().includes(t) ||
      (s.representante || "").toLowerCase().includes(t) ||
      (digitos.length >= 4 && (s.telefone || "").replace(/\D/g, "").includes(digitos)),
  );
}

export default function SolicitacoesAcessoLista() {
  const [termo, setTermo] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-solicitacoes-acesso"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_solicitacoes_acesso", {
        _dias: 30,
        _limit: 100,
      });
      if (error) throw error;
      return (data || []) as SolicitacaoAcesso[];
    },
    refetchInterval: 30000,
  });

  const itens = useMemo(() => filtrarSolicitacoes(data ?? [], termo), [data, termo]);

  const copiar = async (s: SolicitacaoAcesso) => {
    try {
      await navigator.clipboard.writeText(linkParceiro(s.token));
      toast({ title: "Link copiado", description: `Link de ${formatNomeEmpresa(s.nome)} na área de transferência.` });
    } catch {
      toast({ title: "Não foi possível copiar", description: linkParceiro(s.token), variant: "destructive" });
    }
  };

  const enviar = (s: SolicitacaoAcesso) => {
    const fone = (s.telefone || "").replace(/\D/g, "");
    if (!fone) {
      toast({ title: "Sem WhatsApp", description: "Este fornecedor não tem WhatsApp cadastrado.", variant: "destructive" });
      return;
    }
    const msg = mensagemLinkParceiro(s.representante || "", s.nome || "", s.token);
    const numero = fone.length > 11 ? fone : `55${fone}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Digite o código (ex.: 1514), a empresa ou o WhatsApp"
            className="pl-8 pr-8"
          />
          {termo && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTermo("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching} className="sm:w-auto">
          {isFetching ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {termo
              ? `Nenhuma solicitação encontrada para "${termo}".`
              : "Nenhum fornecedor pediu acesso nos últimos 30 dias."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {itens.map((s) => {
            const expirado = new Date(s.expira_em).getTime() < Date.now();
            return (
              <Card key={s.id}>
                <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center">
                      <p className="text-2xl font-bold tabular-nums leading-none text-primary">{s.codigo}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">código</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight break-words">
                        {formatNomeEmpresa(s.nome)}
                      </p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {formatNomePessoa(s.representante || "") || "sem representante"} ·{" "}
                        {formatTelefone(s.telefone) || "sem WhatsApp"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] py-0">{motivoLabel(s.finalidade)}</Badge>
                        <span className="text-[11px] text-muted-foreground">{quandoLabel(s.created_at)}</span>
                        {s.confirmado_em && (
                          <Badge variant="secondary" className="text-[10px] py-0">Já confirmado</Badge>
                        )}
                        {!s.confirmado_em && expirado && (
                          <Badge variant="secondary" className="text-[10px] py-0">Código expirado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => enviar(s)} className="flex-1 sm:flex-none">
                      <MessageCircle className="h-4 w-4 mr-1.5" />
                      Enviar pelo WhatsApp
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => void copiar(s)} aria-label="Copiar link de acesso">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
