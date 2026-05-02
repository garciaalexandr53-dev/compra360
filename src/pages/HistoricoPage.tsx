import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatNumber } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, ChevronDown, ChevronUp, Trash2, MoreHorizontal,
  Package, Users, DollarSign, Trophy, Store, Calendar, Filter,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type PeriodFilter = "7d" | "30d" | "90d" | "all";
type StatusFilter = "all" | "finalizada" | "cancelada";

const PAGE_SIZE = 10;

const HistoricoPage = () => {
  const queryClient = useQueryClient();
  const [searchItem, setSearchItem] = useState("");
  const [searchCotacao, setSearchCotacao] = useState("");
  const [expandedCotacao, setExpandedCotacao] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Cotações + loja + summary inline (number of products, suppliers responded, total order value)
  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["cotacoes-historico-v2"],
    queryFn: async () => {
      const { data: cots, error } = await supabase
        .from("cotacoes")
        .select("id, nome, status, created_at, finalizada_at, loja_id")
        .neq("status", "ativa")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!cots?.length) return [];

      const lojaIds = Array.from(new Set(cots.map((c) => c.loja_id).filter(Boolean))) as string[];
      const { data: lojas } = lojaIds.length
        ? await supabase.from("lojas").select("id, nome").in("id", lojaIds)
        : { data: [] as any[] };
      const lojaMap = new Map((lojas || []).map((l: any) => [l.id, l.nome]));

      // Summary per cotação: products count, responding suppliers, total ordered
      const cotIds = cots.map((c) => c.id);
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("cotacao_id, total")
        .in("cotacao_id", cotIds);
      const totalByCot = new Map<string, number>();
      for (const p of pedidos || []) {
        totalByCot.set(p.cotacao_id, (totalByCot.get(p.cotacao_id) || 0) + Number(p.total || 0));
      }

      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("id, cotacao_id")
        .in("cotacao_id", cotIds);
      const prodCountByCot = new Map<string, number>();
      const cpsByCot = new Map<string, string[]>();
      for (const cp of cps || []) {
        prodCountByCot.set(cp.cotacao_id, (prodCountByCot.get(cp.cotacao_id) || 0) + 1);
        if (!cpsByCot.has(cp.cotacao_id)) cpsByCot.set(cp.cotacao_id, []);
        cpsByCot.get(cp.cotacao_id)!.push(cp.id);
      }

      const allCpIds = (cps || []).map((cp: any) => cp.id);
      const { data: precos } = allCpIds.length
        ? await supabase
            .from("precos")
            .select("cotacao_produto_id, fornecedor_id")
            .in("cotacao_produto_id", allCpIds)
            .not("preco", "is", null)
        : { data: [] as any[] };
      const cpToCot = new Map<string, string>();
      for (const cp of cps || []) cpToCot.set(cp.id, cp.cotacao_id);
      const fornsByCot = new Map<string, Set<string>>();
      for (const p of precos || []) {
        const cotId = cpToCot.get(p.cotacao_produto_id);
        if (!cotId) continue;
        if (!fornsByCot.has(cotId)) fornsByCot.set(cotId, new Set());
        fornsByCot.get(cotId)!.add(p.fornecedor_id);
      }

      return cots.map((c) => ({
        ...c,
        loja_nome: c.loja_id ? lojaMap.get(c.loja_id) || null : null,
        produtos_count: prodCountByCot.get(c.id) || 0,
        fornecedores_count: fornsByCot.get(c.id)?.size || 0,
        total_pedido: totalByCot.get(c.id) || 0,
      }));
    },
  });

  const { data: cotacaoDetails } = useQuery({
    queryKey: ["cotacao-details-v2", expandedCotacao],
    enabled: !!expandedCotacao,
    queryFn: async () => {
      const { data: cps, error: cpErr } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(nome, embalagem)")
        .eq("cotacao_id", expandedCotacao!);
      if (cpErr) throw cpErr;

      const cpIds = (cps || []).map((cp: any) => cp.id);
      let precos: any[] = [];
      if (cpIds.length) {
        const { data: p } = await supabase
          .from("precos")
          .select("*, fornecedores(id, nome)")
          .in("cotacao_produto_id", cpIds);
        precos = p || [];
      }

      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, fornecedor_id, total, status, fornecedores(nome)")
        .eq("cotacao_id", expandedCotacao!);

      return { produtos: cps || [], precos, pedidos: pedidos || [] };
    },
  });

  const { data: itemSearchResults = [] } = useQuery({
    queryKey: ["item-search", searchItem],
    enabled: searchItem.length >= 2,
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("produtos")
        .select("id, nome")
        .ilike("nome", `%${searchItem}%`)
        .limit(20);
      if (!prods?.length) return [];

      const prodIds = prods.map((p) => p.id);
      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("*, cotacoes(nome, created_at, status), produtos(nome, embalagem)")
        .in("produto_id", prodIds)
        .order("cotacao_id");
      if (!cps?.length) return [];

      const cpIds = cps.map((cp: any) => cp.id);
      const { data: precos } = await supabase
        .from("precos")
        .select("*, fornecedores(nome)")
        .in("cotacao_produto_id", cpIds)
        .not("preco", "is", null);

      return cps.map((cp: any) => ({
        ...cp,
        precos: (precos || []).filter((p: any) => p.cotacao_produto_id === cp.id),
      }));
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const ids = cotacoes.map((c) => c.id);
      if (!ids.length) return;
      for (const cotId of ids) {
        const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotId);
        if (cps?.length) {
          const cpIds = cps.map((cp: any) => cp.id);
          await supabase.from("precos").delete().in("cotacao_produto_id", cpIds);
        }
        await supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotId);
        await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotId);
      }
      await supabase.from("cotacoes").delete().in("id", ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes-historico-v2"] });
      setExpandedCotacao(null);
      toast.success("Histórico limpo com sucesso!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (cotId: string) => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotId);
      if (cps?.length) {
        const cpIds = cps.map((cp: any) => cp.id);
        await supabase.from("precos").delete().in("cotacao_produto_id", cpIds);
      }
      await supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotId);
      await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotId);
      await supabase.from("cotacoes").delete().eq("id", cotId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes-historico-v2"] });
      setExpandedCotacao(null);
      toast.success("Cotação removida!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // Filters
  const filteredCotacoes = useMemo(() => {
    const now = Date.now();
    const periodMs: Record<PeriodFilter, number> = {
      "7d": 7 * 86400000,
      "30d": 30 * 86400000,
      "90d": 90 * 86400000,
      all: Infinity,
    };
    const cutoff = now - periodMs[periodFilter];

    return cotacoes.filter((c) => {
      if (searchCotacao && !c.nome.toLowerCase().includes(searchCotacao.toLowerCase())) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (periodFilter !== "all" && new Date(c.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [cotacoes, searchCotacao, statusFilter, periodFilter]);

  const visibleCotacoes = filteredCotacoes.slice(0, visibleCount);

  const toggleExpand = (id: string) => {
    setExpandedCotacao(expandedCotacao === id ? null : id);
  };

  // Compute table rows for an expanded cotação: pick cheapest supplier per product
  const buildTableRows = () => {
    if (!cotacaoDetails) return [] as any[];
    return cotacaoDetails.produtos.map((cp: any) => {
      const cpPrecos = cotacaoDetails.precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco != null);
      const sorted = [...cpPrecos].sort((a, b) => Number(a.preco) - Number(b.preco));
      const winner = sorted[0] || null;
      const qtd = Number(cp.quantidade || 1);
      const fator = Number(cp.fator_embalagem || 1);
      const precoUnit = winner ? Number(winner.preco) : null;
      const total = precoUnit != null ? precoUnit * qtd : null;
      return {
        id: cp.id,
        nome: cp.produtos?.nome || "—",
        embalagem: cp.tipo_embalagem || cp.produtos?.embalagem || "un",
        fator,
        qtd,
        fornecedor: winner?.fornecedores?.nome || "—",
        precoUnit,
        total,
        allPrecos: sorted,
      };
    });
  };

  // Pedidos by fornecedor (from cotacaoDetails)
  const buildPedidosByFornecedor = () => {
    if (!cotacaoDetails) return [] as any[];
    const rows = buildTableRows();
    const byForn = new Map<string, { fornecedor: string; itens: any[]; total: number }>();
    for (const r of rows) {
      if (!r.fornecedor || r.fornecedor === "—") continue;
      if (!byForn.has(r.fornecedor)) byForn.set(r.fornecedor, { fornecedor: r.fornecedor, itens: [], total: 0 });
      const g = byForn.get(r.fornecedor)!;
      g.itens.push(r);
      g.total += r.total || 0;
    }
    return Array.from(byForn.values()).sort((a, b) => b.total - a.total);
  };

  const tableRows = expandedCotacao ? buildTableRows() : [];
  const pedidosByFornecedor = expandedCotacao ? buildPedidosByFornecedor() : [];
  const totalGeral = tableRows.reduce((acc, r) => acc + (r.total || 0), 0);

  const statusBadgeClass = (status: string) =>
    status === "finalizada"
      ? "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30"
      : "bg-muted text-muted-foreground border";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-bold">Histórico</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{cotacoes.length}</span>
        </div>
        {cotacoes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <MoreHorizontal className="h-4 w-4" />
                <span className="text-xs">Mais</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Limpar Histórico
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá remover {cotacoes.length} cotação(ões) e todos os preços associados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearHistoryMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Limpar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Tabs defaultValue="cotacoes">
        <TabsList className="w-full">
          <TabsTrigger value="cotacoes" className="flex-1 text-xs">Por Cotação</TabsTrigger>
          <TabsTrigger value="itens" className="flex-1 text-xs">Buscar Item</TabsTrigger>
        </TabsList>

        <TabsContent value="cotacoes" className="space-y-4">
          {/* Filtros */}
          <div className="bg-card border rounded-xl p-3 md:p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cotação por nome..."
                  value={searchCotacao}
                  onChange={(e) => setSearchCotacao(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-1">
                {(["7d", "30d", "90d", "all"] as PeriodFilter[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                      periodFilter === p
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "all" ? "Tudo" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg p-1">
                {(["all", "finalizada", "cancelada"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors capitalize ${
                      statusFilter === s
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "all" ? "Todos" : s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de cotações */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filteredCotacoes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhuma cotação encontrada com os filtros atuais.
            </div>
          ) : (
            <>
              {visibleCotacoes.map((c) => {
                const isOpen = expandedCotacao === c.id;
                return (
                  <div key={c.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                    {/* Card compacto */}
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(c.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm md:text-base font-bold text-foreground truncate">{c.nome}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${statusBadgeClass(c.status)}`}>
                              {c.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDateTime(c.created_at)}
                            </span>
                            {c.loja_nome && (
                              <span className="flex items-center gap-1">
                                <Store className="h-3 w-3" /> {c.loja_nome}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover "{c.nome}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa cotação e todos os seus preços serão removidos permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSingleMutation.mutate(c.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Métricas compactas */}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Package className="h-3 w-3" /> Produtos
                          </div>
                          <div className="text-sm font-bold text-foreground">{c.produtos_count}</div>
                        </div>
                        <div className="bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3" /> Responderam
                          </div>
                          <div className="text-sm font-bold text-foreground">{c.fornecedores_count}</div>
                        </div>
                        <div className="bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/10">
                          <div className="flex items-center gap-1 text-[10px] text-primary/80">
                            <DollarSign className="h-3 w-3" /> Total pedido
                          </div>
                          <div className="text-sm font-bold text-primary">{formatBRL(c.total_pedido)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Expansão */}
                    {isOpen && (
                      <div className="border-t bg-muted/10">
                        {!cotacaoDetails ? (
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                        ) : tableRows.length === 0 ? (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            Esta cotação não tem produtos.
                          </div>
                        ) : (
                          <div className="p-3 md:p-4 space-y-4">
                            {/* Tabela principal */}
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                                Resumo do pedido
                              </div>
                              <div className="border rounded-lg overflow-hidden bg-background">
                                <ScrollArea className="max-h-[460px]">
                                  <table className="w-full text-xs md:text-sm">
                                    <thead className="bg-muted/60 sticky top-0">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Produto</th>
                                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Embal.</th>
                                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Fator</th>
                                        <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Qtd</th>
                                        <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fornecedor</th>
                                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Preço un.</th>
                                        <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tableRows.map((r) => (
                                        <tr key={r.id} className="border-t hover:bg-muted/30">
                                          <td className="px-3 py-2 font-medium">{r.nome}</td>
                                          <td className="px-3 py-2 text-center text-muted-foreground">{r.embalagem}</td>
                                          <td className="px-3 py-2 text-center text-muted-foreground">×{r.fator}</td>
                                          <td className="px-3 py-2 text-center">{r.qtd}</td>
                                          <td className="px-3 py-2 text-foreground">
                                            {r.fornecedor !== "—" ? (
                                              <span className="inline-flex items-center gap-1">
                                                <Trophy className="h-3 w-3 text-green-600" />
                                                {r.fornecedor}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono">
                                            {r.precoUnit != null ? formatBRL(r.precoUnit) : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-semibold">
                                            {r.total != null ? formatBRL(r.total) : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-primary/30 bg-primary/5">
                                        <td colSpan={6} className="px-3 py-2.5 text-right font-bold uppercase text-xs tracking-wide">
                                          Total geral
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                                          {formatBRL(totalGeral)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </ScrollArea>
                              </div>
                            </div>

                            {/* Pedidos por fornecedor */}
                            {pedidosByFornecedor.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                                  Pedidos por fornecedor
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {pedidosByFornecedor.map((g) => (
                                    <div key={g.fornecedor} className="bg-background border rounded-lg p-3">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="font-bold text-sm truncate">{g.fornecedor}</div>
                                        <div className="font-mono font-bold text-primary text-sm whitespace-nowrap">
                                          {formatBRL(g.total)}
                                        </div>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground mb-2">
                                        {g.itens.length} item(ns)
                                      </div>
                                      <ul className="space-y-0.5 text-xs">
                                        {g.itens.map((it: any) => (
                                          <li key={it.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                                            <span className="truncate">• {it.nome} <span className="text-[10px]">({it.qtd})</span></span>
                                            <span className="font-mono shrink-0">{formatBRL(it.total)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Todos os preços recebidos (colapsável) */}
                            <Collapsible>
                              <CollapsibleTrigger className="w-full flex items-center justify-between bg-background border rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors group">
                                <span className="text-xs font-semibold text-foreground">
                                  Todos os preços recebidos
                                </span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="border rounded-lg overflow-hidden bg-background divide-y">
                                  {tableRows.map((r) => (
                                    <div key={r.id} className="px-3 py-2.5">
                                      <div className="text-xs font-semibold text-foreground mb-1.5">
                                        {r.nome} <span className="text-[10px] text-muted-foreground font-normal">· {r.embalagem}</span>
                                      </div>
                                      {r.allPrecos.length === 0 ? (
                                        <div className="text-[11px] text-muted-foreground italic">Sem preços recebidos.</div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {r.allPrecos.map((p: any, idx: number) => (
                                            <span
                                              key={p.id}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                                                idx === 0
                                                  ? "bg-green-500/15 text-green-700 dark:text-green-400 font-bold border border-green-500/30"
                                                  : "bg-muted text-muted-foreground"
                                              }`}
                                            >
                                              {idx === 0 && <Trophy className="h-2.5 w-2.5" />}
                                              {p.fornecedores?.nome}: {formatBRL(Number(p.preco))}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>

                            <div className="text-[10px] text-muted-foreground text-center pt-1">
                              Exportações (Excel, PDF, Imprimir) chegam na próxima etapa.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleCount < filteredCotacoes.length && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Carregar mais ({filteredCotacoes.length - visibleCount} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="itens" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto (ex: Detergente)..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="pl-9"
            />
          </div>

          {searchItem.length < 2 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Digite pelo menos 2 caracteres para buscar.
            </div>
          ) : itemSearchResults.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum resultado encontrado para "{searchItem}".
            </div>
          ) : (
            (() => {
              const grouped: Record<string, { nome: string; embalagem: string; entries: typeof itemSearchResults }> = {};
              itemSearchResults.forEach((item: any) => {
                const key = item.produtos?.nome || "?";
                if (!grouped[key]) grouped[key] = { nome: key, embalagem: item.produtos?.embalagem || "un", entries: [] };
                grouped[key].entries.push(item);
              });

              return Object.values(grouped).map((group) => (
                <div key={group.nome} className="bg-card border rounded-xl shadow-sm overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <span className="font-bold text-sm text-foreground">{group.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">({group.embalagem})</span>
                  </div>
                  <div className="divide-y">
                    {group.entries
                      .sort((a: any, b: any) => {
                        const da = a.cotacoes?.created_at || "";
                        const db = b.cotacoes?.created_at || "";
                        return db.localeCompare(da);
                      })
                      .map((item: any) => {
                        const minPreco = item.precos.length ? Math.min(...item.precos.map((p: any) => p.preco)) : null;
                        return (
                          <div key={item.id} className="px-4 py-2.5 flex items-start gap-4">
                            <div className="min-w-[140px]">
                              <div className="text-xs font-medium text-muted-foreground">
                                {item.cotacoes?.created_at ? formatDateTime(item.cotacoes.created_at) : "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground/70">{item.cotacoes?.nome}</div>
                            </div>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {item.precos.length === 0 ? (
                                <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                item.precos.sort((a: any, b: any) => a.preco - b.preco).map((p: any) => (
                                  <span
                                    key={p.id}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      p.preco === minPreco ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {p.fornecedores?.nome}: R${formatNumber(p.preco)}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ));
            })()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoPage;
