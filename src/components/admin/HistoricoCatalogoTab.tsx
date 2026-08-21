import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, X, ChevronLeft, ChevronRight, History } from "lucide-react";
import HistoricoCatalogoSheet from "./HistoricoCatalogoSheet";
import {
  CatalogoLogRow, classeAcao, formatarDataHoraLog, labelAcao, nomeItemLog, resolverAutor,
} from "@/lib/catalogoLog";

const PAGE_SIZE = 50;
type FiltroAcao = "todas" | "INSERT" | "UPDATE" | "DELETE";
type Periodo = "7" | "30" | "tudo";

export default function HistoricoCatalogoTab() {
  const { user } = useAuth();
  const [termoInput, setTermoInput] = useState("");
  const [termo, setTermo] = useState("");
  const [acao, setAcao] = useState<FiltroAcao>("todas");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [page, setPage] = useState(0);
  const [detalhe, setDetalhe] = useState<(CatalogoLogRow & { autor: string }) | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(termoInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [termoInput]);

  // Mapa user_id -> e-mail (RPC já usada na aba Clientes)
  const { data: emailMap } = useQuery({
    queryKey: ["admin-clientes-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_clientes");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((c: { user_id: string; email: string | null }) => {
        if (c.user_id && c.email) map[c.user_id] = c.email;
      });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-catalogo-log", termo, acao, periodo, page],
    queryFn: async () => {
      let q = supabase
        .from("catalogo_mestre_log")
        .select("id, catalogo_mestre_id, acao, dados_antes, dados_depois, alterado_por, alterado_em", { count: "exact" })
        .order("alterado_em", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (termo) {
        const t = termo.replace(/[%,()]/g, "");
        q = q.or(`dados_depois->>nome.ilike.%${t}%,dados_antes->>nome.ilike.%${t}%`);
      }
      if (acao !== "todas") q = q.eq("acao", acao);
      if (periodo !== "tudo") {
        const dias = parseInt(periodo, 10);
        q = q.gte("alterado_em", new Date(Date.now() - dias * 86400_000).toISOString());
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { itens: (data || []) as unknown as CatalogoLogRow[], total: count || 0 };
    },
    placeholderData: (prev) => prev,
  });

  const itens = data?.itens || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linhas = useMemo(
    () => itens.map((r) => ({ ...r, autor: resolverAutor(r.alterado_por, user?.id, emailMap || {}) })),
    [itens, emailMap, user?.id],
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={termoInput}
            onChange={(e) => setTermoInput(e.target.value)}
            placeholder="Buscar por nome do item"
            className="pl-8 pr-8"
          />
          {termoInput && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTermoInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Select value={acao} onValueChange={(v) => { setAcao(v as FiltroAcao); setPage(0); }}>
            <SelectTrigger className="h-9 sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ações</SelectItem>
              <SelectItem value="INSERT">Criados</SelectItem>
              <SelectItem value="UPDATE">Editados</SelectItem>
              <SelectItem value="DELETE">Removidos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodo} onValueChange={(v) => { setPeriodo(v as Periodo); setPage(0); }}>
            <SelectTrigger className="h-9 sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="tudo">Tudo</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground sm:ml-auto flex items-center gap-1.5">
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} ${total === 1 ? "registro" : "registros"}`}
          </span>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : linhas.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-2">
          <History className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Nenhuma alteração encontrada{termo ? ` para "${termo}"` : ""}.
          </p>
          <p className="text-xs text-muted-foreground">
            As criações, edições e remoções do Catálogo Mestre aparecem aqui automaticamente.
          </p>
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-[150px]">Data/hora</th>
                  <th className="text-left px-3 py-2 font-medium w-[110px]">Ação</th>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium w-[220px]">Alterado por</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetalhe(r)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatarDataHoraLog(r.alterado_em)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={classeAcao(r.acao)}>{labelAcao(r.acao)}</Badge>
                    </td>
                    <td className="px-3 py-2">{nomeItemLog(r)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground break-all">{r.autor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {linhas.map((r) => (
              <Card key={r.id} onClick={() => setDetalhe(r)} className="cursor-pointer active:bg-muted/40">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${classeAcao(r.acao)} text-[10px] py-0`}>{labelAcao(r.acao)}</Badge>
                    <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                      {formatarDataHoraLog(r.alterado_em)}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-tight break-words">{nomeItemLog(r)}</p>
                  <p className="text-[11px] text-muted-foreground break-all">{r.autor}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </>
      )}

      <HistoricoCatalogoSheet row={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}
