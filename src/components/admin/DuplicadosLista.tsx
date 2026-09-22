import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ChevronLeft, ChevronRight, GitMerge, Store, Boxes } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { formatTelefone, formatNomeEmpresa, formatNomePessoa, formatNomeLoja } from "@/lib/masks";
import { tipoFornecedorLabel } from "@/lib/adminHelpers";

const GRUPOS_POR_PAGINA = 30;

export interface DuplicadoCadastro {
  id: string;
  nome: string;
  representante: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
  user_id: string | null;
  cliente_nome: string | null;
  cliente_empresa: string | null;
  cidade: string | null;
  uf: string | null;
  origem_cadastro: string | null;
  tipo_fornecedor: string | null;
  lojas_vinculadas: number;
  total_relacionamentos: number;
  grupo_key: string;
  grupo_tipo: string;
  mestre_sugerido: boolean;
  total_grupos?: number;
  total_count?: number;
}

export interface ResumoUnificacao {
  unificados: number;
  relacionamentos_movidos: number;
}

export interface GrupoDuplicado {
  grupo_key: string;
  grupo_tipo: string;
  cadastros: DuplicadoCadastro[];
}

/** Frase de resultado da unificação, em pt-BR. */
export function resumoUnificacaoLabel(r: ResumoUnificacao): string {
  const u = Number(r.unificados ?? 0);
  const m = Number(r.relacionamentos_movidos ?? 0);
  const partes: string[] = [];
  partes.push(`${u} ${u === 1 ? "cadastro unificado" : "cadastros unificados"}`);
  if (m > 0) partes.push(`${m} ${m === 1 ? "vínculo transferido" : "vínculos transferidos"}`);
  return partes.join(" · ");
}

/** Agrupa os cadastros pelo `grupo_key`, mantendo a ordem de chegada. */
export function agruparDuplicados(itens: DuplicadoCadastro[]): GrupoDuplicado[] {
  const mapa = new Map<string, GrupoDuplicado>();
  for (const c of itens) {
    const atual = mapa.get(c.grupo_key);
    if (atual) atual.cadastros.push(c);
    else mapa.set(c.grupo_key, { grupo_key: c.grupo_key, grupo_tipo: c.grupo_tipo, cadastros: [c] });
  }
  return [...mapa.values()];
}

function localizacao(c: DuplicadoCadastro): string {
  if (c.cidade && c.uf) return `${formatNomeLoja(c.cidade)}/${c.uf.toUpperCase()}`;
  return c.cidade ? formatNomeLoja(c.cidade) : c.uf ? c.uf.toUpperCase() : "—";
}

function clienteLabel(c: DuplicadoCadastro): string {
  return c.cliente_empresa || c.cliente_nome || "—";
}

export default function DuplicadosLista({ termo }: { termo: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [mestrePorGrupo, setMestrePorGrupo] = useState<Record<string, string>>({});
  const [confirma, setConfirma] = useState<GrupoDuplicado | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-duplicados", termo, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_duplicados", {
        _search: termo || null,
        _limit: GRUPOS_POR_PAGINA,
        _offset: page * GRUPOS_POR_PAGINA,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as DuplicadoCadastro[];
      return { itens: rows, totalGrupos: Number(rows[0]?.total_grupos ?? 0), totalCadastros: Number(rows[0]?.total_count ?? 0) };
    },
    placeholderData: (prev) => prev,
  });

  const itens = data?.itens ?? [];
  const grupos = useMemo(() => agruparDuplicados(itens), [itens]);
  const totalGrupos = data?.totalGrupos ?? 0;
  const totalCadastros = data?.totalCadastros ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalGrupos / GRUPOS_POR_PAGINA));

  // Inicializa o mestre selecionado com o sugerido quando os dados chegam.
  useEffect(() => {
    setMestrePorGrupo((prev) => {
      const next = { ...prev };
      let mudou = false;
      for (const g of grupos) {
        if (!next[g.grupo_key]) {
          const sug = g.cadastros.find((c) => c.mestre_sugerido) ?? g.cadastros[0];
          if (sug) {
            next[g.grupo_key] = sug.id;
            mudou = true;
          }
        }
      }
      return mudou ? next : prev;
    });
  }, [grupos]);

  const unificar = useMutation({
    mutationFn: async (grupo: GrupoDuplicado) => {
      const mestreId = mestrePorGrupo[grupo.grupo_key];
      if (!mestreId) throw new Error("Escolha o cadastro principal.");
      const sobressalentes = grupo.cadastros.filter((c) => c.id !== mestreId).map((c) => c.id);
      if (sobressalentes.length === 0) throw new Error("Não há cadastros para unificar.");
      const { data, error } = await supabase.rpc("admin_unificar_fornecedor", {
        _mestre_id: mestreId,
        _sobressalente_ids: sobressalentes,
      });
      if (error) throw error;
      return (data || {}) as unknown as ResumoUnificacao;
    },
    onSuccess: (r) => {
      toast.success(resumoUnificacaoLabel(r));
      setConfirma(null);
      qc.invalidateQueries({ queryKey: ["admin-duplicados"] });
      qc.invalidateQueries({ queryKey: ["admin-rede-unificada"] });
      qc.invalidateQueries({ queryKey: ["admin-fornecedores"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível unificar agora."),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          {isLoading
            ? "Carregando…"
            : totalGrupos > 0
              ? `${totalGrupos.toLocaleString("pt-BR")} ${totalGrupos === 1 ? "grupo com duplicatas" : "grupos com duplicatas"} · ${totalCadastros.toLocaleString("pt-BR")} cadastros`
              : "Nenhum duplicado encontrado"}
        </span>
        <span className="hidden sm:inline">Escolha o cadastro principal e unifique</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum fornecedor duplicado{termo ? ` para "${termo}"` : ""}.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const mestreId = mestrePorGrupo[g.grupo_key];
            const podeUnificar = g.cadastros.length > 1;
            return (
              <Card key={g.grupo_key}>
                <CardContent className="p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={g.grupo_tipo === "whatsapp" ? "default" : "secondary"} className="text-[10px] py-0">
                        {g.grupo_tipo === "whatsapp" ? "Mesmo WhatsApp" : "Mesmo nome"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {g.cadastros.length} cadastros
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!podeUnificar || unificar.isPending}
                      onClick={() => setConfirma(g)}
                    >
                      <GitMerge className="h-3.5 w-3.5 mr-1.5" /> Unificar registros
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {g.cadastros.map((c) => {
                      const checked = c.id === mestreId;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                            checked ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`mestre-${g.grupo_key}`}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            checked={checked}
                            onChange={() => setMestrePorGrupo((prev) => ({ ...prev, [g.grupo_key]: c.id }))}
                            aria-label={`Marcar como cadastro principal: ${c.nome}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium leading-tight break-words">
                                {formatNomeEmpresa(c.nome)}
                              </span>
                              {checked && <Badge className="text-[10px] py-0">Principal</Badge>}
                              {c.mestre_sugerido && !checked && (
                                <Badge variant="outline" className="text-[10px] py-0">Sugerido</Badge>
                              )}
                              {c.origem_cadastro === "autocadastro" && (
                                <Badge variant="secondary" className="text-[10px] py-0">Rede</Badge>
                              )}
                              {c.tipo_fornecedor && (
                                <Badge variant="outline" className="text-[10px] py-0">{tipoFornecedorLabel(c.tipo_fornecedor)}</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground break-words">
                              {formatNomePessoa(c.representante) || "sem representante"} · {formatTelefone(c.telefone) || "sem WhatsApp"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Store className="h-3 w-3" />
                                {clienteLabel(c)}
                              </span>
                              <span>·</span>
                              <span>{localizacao(c)}</span>
                              <span>·</span>
                              <span>
                                {Number(c.lojas_vinculadas)} {Number(c.lojas_vinculadas) === 1 ? "loja" : "lojas"}
                              </span>
                              {Number(c.total_relacionamentos) > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Boxes className="h-3 w-3" />
                                    {Number(c.total_relacionamentos)} {Number(c.total_relacionamentos) === 1 ? "vínculo" : "vínculos"}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Cadastrado em {formatDate(c.created_at)}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && totalGrupos > GRUPOS_POR_PAGINA && (
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Anterior</span>
          </Button>
          <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirma} onOpenChange={(o) => !o && setConfirma(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar cadastros duplicados?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro principal manterá todos os vínculos: lojas, cidades atendidas, cotações, preços, pedidos e
              histórico. Os demais serão removidos de forma segura e nenhum cliente será avisado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={unificar.isPending}
              onClick={() => confirma && unificar.mutate(confirma)}
            >
              {unificar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar unificação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
