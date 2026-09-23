import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, X, ChevronLeft, ChevronRight, FileSpreadsheet,
  MessageCircle, CheckCircle2, XCircle, Clock, MapPin,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { buildWhatsAppUrl } from "@/lib/format";
import { formatTelefone, formatNomeEmpresa, formatNomePessoa } from "@/lib/masks";
import { tipoFornecedorLabel, pastasLabel } from "@/lib/adminHelpers";
import {
  ConsentimentoFornecedor, buildConsentimentosXlsx, consentimentosFilenameXlsx,
  downloadXlsx, formatCnpjBR, consentimentoLabel, ultimaPerguntaLabel,
} from "@/lib/adminExports";

const PAGE_SIZE = 50;

export type StatusConsentimento = "todos" | "sim" | "nao" | "pendente";

const STATUS_FILTROS: { key: StatusConsentimento; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sim", label: "Participam" },
  { key: "nao", label: "Recusaram" },
  { key: "pendente", label: "Pendentes" },
];

/** Cores e ícone do selo de consentimento. */
export function consentimentoEstilo(status: string | null | undefined): {
  classe: string;
  Icone: typeof CheckCircle2;
} {
  if (status === "sim")
    return {
      classe: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
      Icone: CheckCircle2,
    };
  if (status === "nao")
    return {
      classe: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
      Icone: XCircle,
    };
  return {
    classe: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    Icone: Clock,
  };
}

export default function ConsentimentoLista() {
  const [termoInput, setTermoInput] = useState("");
  const [termo, setTermo] = useState("");
  const [status, setStatus] = useState<StatusConsentimento>("todos");
  const [page, setPage] = useState(0);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(termoInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [termoInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-consentimentos", termo, status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_consentimentos", {
        _search: termo || null,
        _status: status,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data || []) as unknown as ConsentimentoFornecedor[];
    },
  });

  const itens = data || [];
  const total = Number(itens[0]?.total_count ?? 0);
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resumo = useMemo(
    () => ({
      total,
      sim: Number(itens[0]?.total_sim ?? 0),
      nao: Number(itens[0]?.total_nao ?? 0),
      pendente: Number(itens[0]?.total_pendente ?? 0),
    }),
    [itens, total],
  );

  async function exportar() {
    setExportando(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_consentimentos", {
        _search: termo || null,
        _status: status,
        _limit: 5000,
        _offset: 0,
      });
      if (error) throw error;
      const linhas = (data || []) as unknown as ConsentimentoFornecedor[];
      downloadXlsx(consentimentosFilenameXlsx(), buildConsentimentosXlsx(linhas));
      toast({ title: "Planilha gerada", description: `${linhas.length} fornecedores exportados.` });
    } catch (e) {
      toast({
        title: "Não foi possível exportar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ResumoCard titulo="Fornecedores" valor={resumo.total} />
        <ResumoCard titulo="Participam" valor={resumo.sim} tom="text-emerald-600" />
        <ResumoCard titulo="Recusaram" valor={resumo.nao} tom="text-red-600" />
        <ResumoCard titulo="Pendentes" valor={resumo.pendente} tom="text-amber-600" />
      </div>

      {/* Busca e ações */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={termoInput}
            onChange={(e) => setTermoInput(e.target.value)}
            placeholder="Buscar por nome, representante, WhatsApp ou CNPJ"
            className="pl-9 pr-9"
          />
          {termoInput && (
            <button
              type="button"
              onClick={() => setTermoInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={exportar} disabled={exportando || itens.length === 0}>
          {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          <span className="ml-2">Exportar</span>
        </Button>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTROS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={status === f.key ? "default" : "outline"}
            onClick={() => {
              setStatus(f.key);
              setPage(0);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum fornecedor encontrado com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {itens.map((f) => {
            const { classe, Icone } = consentimentoEstilo(f.consentimento_rede);
            return (
              <li key={f.id}>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {formatNomeEmpresa(f.nome)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatNomePessoa(f.representante) || "Sem representante"}
                          {f.telefone ? ` · ${formatTelefone(f.telefone)}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] gap-1 ${classe}`}>
                        <Icone className="h-3 w-3" />
                        {consentimentoLabel(f.consentimento_rede)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <Info rotulo="CNPJ" valor={formatCnpjBR(f.cnpj) || "Não informado"} />
                      <Info rotulo="Tipo" valor={tipoFornecedorLabel(f.tipo_fornecedor)} />
                      <Info rotulo="Pastas" valor={pastasLabel(f.pasta) || "—"} />
                      <Info rotulo="Última pergunta" valor={ultimaPerguntaLabel(f.consentimento_ultima_pergunta)} />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
                        <span className="shrink-0">
                          {Number(f.clientes ?? 0)} {Number(f.clientes) === 1 ? "cliente" : "clientes"}
                          {" · "}
                          {Number(f.lojas_vinculadas ?? 0)} {Number(f.lojas_vinculadas) === 1 ? "loja" : "lojas"}
                        </span>
                        {(f.cidades?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-1 min-w-0">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{f.cidades!.slice(0, 3).join(", ")}</span>
                          </span>
                        )}
                      </div>
                      {f.telefone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 shrink-0"
                          onClick={() => window.open(buildWhatsAppUrl(f.telefone!, ""), "_blank")}
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPaginas} · {total} fornecedores
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPaginas || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumoCard({ titulo, valor, tom }: { titulo: string; valor: number; tom?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{titulo}</div>
        <div className={`text-xl font-semibold ${tom || ""}`}>{valor}</div>
      </CardContent>
    </Card>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="truncate">{valor}</div>
    </div>
  );
}
