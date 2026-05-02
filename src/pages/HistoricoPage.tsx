import { useEffect, useMemo, useState } from "react";
import { format as formatDate, parseISO, isValid as isValidDate } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, ChevronDown, ChevronUp, Trash2, MoreHorizontal,
  Package, Users, DollarSign, Trophy, Store, Calendar, Filter,
  FileSpreadsheet, FileText, Printer, BarChart3, TrendingUp,
  CheckSquare, X, Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  exportCotacaoToExcel, exportCotacaoToPdf, printCotacao,
  exportConsolidadoToExcel, exportConsolidadoToPdf,
  type ConsolidatedCotacao, type ConsolidatedSummary,
} from "@/lib/historicoExports";
import {
  computeKPIs, buildFornecedorRanking, buildProdutoVariacao,
  type InsightRow,
} from "@/lib/historicoInsights";
import type { Tables } from "@/integrations/supabase/types";

type PeriodFilter = "7d" | "30d" | "90d" | "all" | "custom";
type StatusFilter = "all" | "finalizada" | "cancelada";
type LojaFilter = "active" | "all";

const PAGE_SIZE = 10;
const DEFAULT_PERIOD: PeriodFilter = "30d";
const DEFAULT_STATUS: StatusFilter = "all";
const DEFAULT_LOJA: LojaFilter = "active";

type InsightsFiltersProps = {
  period: PeriodFilter;
  setPeriod: (p: PeriodFilter) => void;
  customStart?: Date;
  customEnd?: Date;
  setCustomStart: (d?: Date) => void;
  setCustomEnd: (d?: Date) => void;
  lojaId: string | "all" | null;
  setLojaId: (id: string | "all" | null) => void;
  lojas: { id: string; nome: string }[];
  lojaAtivaNome?: string;
  cotacoesCount: number;
  periodLabel: (p: PeriodFilter, cs?: Date, ce?: Date) => string;
};

function CustomRangePicker({
  open, setOpen, start, end, setStart, setEnd,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  start?: Date;
  end?: Date;
  setStart: (d?: Date) => void;
  setEnd: (d?: Date) => void;
}) {
  const fmt = (d?: Date) => (d ? formatDate(d, "dd/MM/yy") : "");
  const [startText, setStartText] = useState(fmt(start));
  const [endText, setEndText] = useState(fmt(end));

  useEffect(() => { setStartText(fmt(start)); }, [start]);
  useEffect(() => { setEndText(fmt(end)); }, [end]);

  const parseInput = (txt: string): Date | undefined => {
    const m = txt.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!m) return undefined;
    const [, dd, mm, yy] = m;
    const year = 2000 + parseInt(yy, 10);
    const d = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10));
    return isValidDate(d) ? d : undefined;
  };

  // Auto-insert "/" while typing: 12 -> 12/, 1203 -> 12/03/, etc.
  const formatTyping = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    let out = digits;
    if (digits.length >= 3 && digits.length <= 4) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else if (digits.length >= 5) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    return out;
  };

  const commitStart = () => {
    const d = parseInput(startText);
    if (d) setStart(d);
    else if (startText === "") setStart(undefined);
    else setStartText(fmt(start));
  };
  const commitEnd = () => {
    const d = parseInput(endText);
    if (d) setEnd(d);
    else if (endText === "") setEnd(undefined);
    else setEndText(fmt(end));
  };

  // Validation: start must not be after end
  const parsedStart = parseInput(startText) ?? start;
  const parsedEnd = parseInput(endText) ?? end;
  const invalidRange = !!(parsedStart && parsedEnd && parsedStart > parsedEnd);

  // Sequential single calendar: 1st tap = start, 2nd tap = end (auto-close).
  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    if (range.from && !range.to) {
      setStart(range.from);
      setEnd(undefined);
      return;
    }
    if (range.from && range.to) {
      const a = range.from <= range.to ? range.from : range.to;
      const b = range.from <= range.to ? range.to : range.from;
      setStart(a);
      setEnd(b);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-full bg-muted text-foreground hover:bg-muted/80 px-2.5 py-0.5 text-xs font-medium border"
          aria-label="Editar intervalo personalizado"
        >
          {start ? formatDate(start, "dd/MM/yy") : "Início"}
          <span className="opacity-50">→</span>
          {end ? formatDate(end, "dd/MM/yy") : "Fim"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="p-3 space-y-3 w-[calc(100vw-1rem)] max-w-[360px] sm:max-w-[380px]"
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data inicial</label>
            <Input
              inputMode="numeric"
              placeholder="DD/MM/AA"
              value={startText}
              onChange={(e) => setStartText(formatTyping(e.target.value))}
              onBlur={commitStart}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitStart(); } }}
              maxLength={8}
              aria-invalid={invalidRange}
              className={cn("h-9 text-sm", invalidRange && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data final</label>
            <Input
              inputMode="numeric"
              placeholder="DD/MM/AA"
              value={endText}
              onChange={(e) => setEndText(formatTyping(e.target.value))}
              onBlur={commitEnd}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEnd(); } }}
              maxLength={8}
              aria-invalid={invalidRange}
              className={cn("h-9 text-sm", invalidRange && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
        </div>
        {invalidRange && (
          <p className="text-[11px] text-destructive text-center font-medium">
            A data inicial não pode ser maior que a data final.
          </p>
        )}
        <div className="flex justify-center">
          <CalendarPicker
            mode="range"
            selected={{ from: start, to: end }}
            onSelect={handleSelect as any}
            numberOfMonths={1}
            defaultMonth={start ?? end ?? new Date()}
            className="p-2 pointer-events-auto rounded-md border"
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Toque na data inicial e depois na final, ou digite acima.
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setStart(undefined); setEnd(undefined); }}>
            Limpar
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} disabled={!start || !end || invalidRange}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InsightsFilters({
  period, setPeriod, customStart, customEnd, setCustomStart, setCustomEnd,
  lojaId, setLojaId, lojas, lojaAtivaNome, cotacoesCount, periodLabel,
}: InsightsFiltersProps) {
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(period === "custom");
  const [lojaOpen, setLojaOpen] = useState(false);

  const currentLojaName =
    lojaId === null
      ? lojaAtivaNome ?? "Loja ativa"
      : lojaId === "all"
      ? "Todas as lojas"
      : lojas.find((l) => l.id === lojaId)?.nome ?? "Loja";

  const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: "7d", label: "7 dias" },
    { value: "30d", label: "30 dias" },
    { value: "90d", label: "90 dias" },
    { value: "all", label: "Tudo" },
    { value: "custom", label: "Personalizado" },
  ];

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
      <span>Análise de:</span>
      <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold border border-transparent transition-colors"
            aria-label="Selecionar período"
          >
            <Calendar className="h-3 w-3" />
            {periodLabel(period, customStart, customEnd)}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 p-1">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value === "custom") {
                  setPeriod("custom");
                  setPeriodOpen(false);
                  setCustomOpen(true);
                } else {
                  setPeriod(opt.value);
                  setPeriodOpen(false);
                }
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-muted ${
                period === opt.value ? "bg-muted font-semibold" : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Custom date range — sequential single calendar + text inputs */}
      {period === "custom" && (
        <CustomRangePicker
          open={customOpen}
          setOpen={setCustomOpen}
          start={customStart}
          end={customEnd}
          setStart={setCustomStart}
          setEnd={setCustomEnd}
        />
      )}

      {/* Loja selector */}
      <Popover open={lojaOpen} onOpenChange={setLojaOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2.5 py-0.5 text-xs font-semibold border border-transparent transition-colors max-w-[220px]"
            aria-label="Selecionar loja"
          >
            <Store className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentLojaName}</span>
            <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1 max-h-72 overflow-auto">
          <button
            onClick={() => {
              setLojaId("all");
              setLojaOpen(false);
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-muted ${
              lojaId === "all" ? "bg-muted font-semibold" : ""
            }`}
          >
            Todas as lojas
          </button>
          {lojaAtivaNome && (
            <button
              onClick={() => {
                setLojaId(null);
                setLojaOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-muted ${
                lojaId === null ? "bg-muted font-semibold" : ""
              }`}
            >
              Loja ativa · {lojaAtivaNome}
            </button>
          )}
          <div className="h-px bg-border my-1" />
          {lojas.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLojaId(l.id);
                setLojaOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-muted truncate ${
                lojaId === l.id ? "bg-muted font-semibold" : ""
              }`}
            >
              {l.nome}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Badge variant="secondary" className="font-normal">{cotacoesCount} cotação(ões)</Badge>
    </div>
  );
}

const HistoricoPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, lojas } = useLojaAtiva();
  const [activeTab, setActiveTab] = useState<"cotacoes" | "insights" | "itens">("cotacoes");
  const [searchItem, setSearchItem] = useState("");
  const [searchCotacao, setSearchCotacao] = useState("");
  const [expandedCotacao, setExpandedCotacao] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(DEFAULT_PERIOD);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS);
  const [lojaFilter, setLojaFilter] = useState<LojaFilter>(DEFAULT_LOJA);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  // Insights tab uses its own filters (independent of "Por Cotação")
  const [insightsPeriod, setInsightsPeriod] = useState<PeriodFilter>(DEFAULT_PERIOD);
  const [insightsCustomStart, setInsightsCustomStart] = useState<Date | undefined>();
  const [insightsCustomEnd, setInsightsCustomEnd] = useState<Date | undefined>();
  const [insightsLojaId, setInsightsLojaId] = useState<string | "all" | null>(null); // null = follow active
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Selection mode for consolidated export
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Pagination per product group on "Buscar Item" tab — reset when search changes
  const ITEM_PAGE_SIZE = 25;
  const [itemVisibleByGroup, setItemVisibleByGroup] = useState<Record<string, number>>({});
  // View mode toggle for "Buscar Item": 'all' = all suppliers, 'best' = winner per cotação
  const [itemViewMode, setItemViewMode] = useState<"all" | "best">("all");
  // Collapsed/expanded state per product group
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Reset per-group pagination + collapse whenever the search term changes
  useMemo(() => {
    setItemVisibleByGroup({});
    setExpandedGroups({});
  }, [searchItem]);

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
            .select("cotacao_produto_id, fornecedor_id, preco")
            .in("cotacao_produto_id", allCpIds)
            .gt("preco", 0)
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
        .gt("preco", 0);

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

  // Helper: compute [start, end] timestamp window for a period filter
  const periodWindow = (
    p: PeriodFilter,
    cs?: Date,
    ce?: Date
  ): { start: number; end: number } => {
    const now = Date.now();
    if (p === "all") return { start: -Infinity, end: Infinity };
    if (p === "custom") {
      const start = cs ? new Date(cs).setHours(0, 0, 0, 0) : -Infinity;
      const end = ce ? new Date(ce).setHours(23, 59, 59, 999) : Infinity;
      return { start, end };
    }
    const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
    return { start: now - days * 86400000, end: Infinity };
  };

  // Filters (Por Cotação)
  const filteredCotacoes = useMemo(() => {
    const { start, end } = periodWindow(periodFilter, customStart, customEnd);
    const activeLojaId = lojaFilter === "active" ? lojaAtiva?.id ?? null : null;

    return cotacoes.filter((c) => {
      if (searchCotacao && !c.nome.toLowerCase().includes(searchCotacao.toLowerCase())) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const t = new Date(c.created_at).getTime();
      if (t < start || t > end) return false;
      if (lojaFilter === "active" && activeLojaId && c.loja_id !== activeLojaId) return false;
      return true;
    });
  }, [cotacoes, searchCotacao, statusFilter, periodFilter, customStart, customEnd, lojaFilter, lojaAtiva?.id]);

  const activeFiltersCount =
    (periodFilter !== DEFAULT_PERIOD ? 1 : 0) +
    (statusFilter !== DEFAULT_STATUS ? 1 : 0) +
    (lojaFilter !== DEFAULT_LOJA ? 1 : 0);

  const periodLabel = (p: PeriodFilter, cs?: Date, ce?: Date) => {
    if (p === "all") return "Tudo";
    if (p === "custom") {
      const fmt = (d?: Date) => (d ? formatDate(d, "dd/MM/yy") : "—");
      return `${fmt(cs)} a ${fmt(ce)}`;
    }
    return p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias";
  };
  const statusLabel = (s: StatusFilter) =>
    s === "all" ? "Todos" : s === "finalizada" ? "Finalizada" : "Cancelada";


  const visibleCotacoes = filteredCotacoes.slice(0, visibleCount);

  const toggleExpand = (id: string) => {
    setExpandedCotacao(expandedCotacao === id ? null : id);
  };

  // Compute table rows for an expanded cotação: pick cheapest supplier per product
  const buildTableRows = () => {
    if (!cotacaoDetails) return [] as any[];
    return cotacaoDetails.produtos.map((cp: any) => {
      // Suppliers who don't sell the item often record preco = 0; ignore those when picking the winner.
      const cpPrecos = cotacaoDetails.precos.filter(
        (p: any) => p.cotacao_produto_id === cp.id && p.preco != null && Number(p.preco) > 0
      );
      const sorted = [...cpPrecos].sort((a, b) => Number(a.preco) - Number(b.preco));
      const winner = sorted[0] || null;
      const qtd = Number(cp.quantidade || 1);
      const fator = Number(cp.fator_embalagem || 1);
      const precoUnit = winner ? Number(winner.preco) : null;
      const total = precoUnit != null ? precoUnit * qtd * fator : null;
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

  // ---------- BATCH detalhes para Insights / Consolidado ----------
  // Loaded only when the user opens the Insights tab or enables Selection mode,
  // and limited to the currently filtered cotações to avoid heavy queries.
  const filteredIds = useMemo(() => filteredCotacoes.map((c) => c.id), [filteredCotacoes]);
  // For batch query: union of cotações needed by Por Cotação (selection) and Insights tab.
  const batchIds = useMemo(() => {
    const set = new Set<string>(filteredIds);
    if (activeTab === "insights") {
      // We do not yet know insightsFilteredCotacoes IDs at this point in code order,
      // but they are recomputed below from `cotacoes`; include all of `cotacoes` ids.
      // To avoid over-fetching, we instead include all cotacoes (already filtered server-side)
      for (const c of cotacoes) set.add(c.id);
    }
    return Array.from(set);
  }, [filteredIds, activeTab, cotacoes]);
  const batchIdsKey = batchIds.join(",");
  const needsBatchDetails = activeTab === "insights" || selectionMode;

  const { data: batchDetails, isLoading: batchLoading } = useQuery({
    queryKey: ["historico-batch-details", batchIdsKey],
    enabled: needsBatchDetails && batchIds.length > 0,
    queryFn: async () => {
      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("id, cotacao_id, produto_id, tipo_embalagem, fator_embalagem, quantidade, produtos(nome, embalagem)")
        .in("cotacao_id", batchIds);
      const cpList = cps || [];
      const cpIds = cpList.map((cp: any) => cp.id);
      const { data: precos } = cpIds.length
        ? await supabase
            .from("precos")
            .select("id, cotacao_produto_id, fornecedor_id, preco, fornecedores(nome)")
            .in("cotacao_produto_id", cpIds)
            .gt("preco", 0)
        : { data: [] as any[] };
      return { cps: cpList, precos: precos || [] };
    },
  });

  // Build per-cotação rows + winner-only insight rows, in one pass.
  const consolidated = useMemo(() => {
    if (!batchDetails) {
      return {
        perCotacao: new Map<string, { rows: any[]; pedidos: any[] }>(),
        insightRows: [] as InsightRow[],
        allPricesByRow: new Map<string, number[]>(),
      };
    }
    const cpsByCot = new Map<string, any[]>();
    for (const cp of batchDetails.cps) {
      if (!cpsByCot.has(cp.cotacao_id)) cpsByCot.set(cp.cotacao_id, []);
      cpsByCot.get(cp.cotacao_id)!.push(cp);
    }
    const precosByCp = new Map<string, any[]>();
    for (const p of batchDetails.precos) {
      if (!precosByCp.has(p.cotacao_produto_id)) precosByCp.set(p.cotacao_produto_id, []);
      precosByCp.get(p.cotacao_produto_id)!.push(p);
    }

    const perCotacao = new Map<string, { rows: any[]; pedidos: any[] }>();
    const insightRows: InsightRow[] = [];
    const allPricesByRow = new Map<string, number[]>();

    const batchSet = new Set(batchIds);
    const cotsForBatch = cotacoes.filter((c) => batchSet.has(c.id));
    for (const cot of cotsForBatch) {
      const cps = cpsByCot.get(cot.id) || [];
      const rows = cps.map((cp: any) => {
        const ps = (precosByCp.get(cp.id) || []).sort(
          (a: any, b: any) => Number(a.preco) - Number(b.preco)
        );
        const winner = ps[0] || null;
        const qtd = Number(cp.quantidade || 1);
        const fator = Number(cp.fator_embalagem || 1);
        const precoUnit = winner ? Number(winner.preco) : null;
        const total = precoUnit != null ? precoUnit * qtd * fator : null;
        const fornecedor = winner?.fornecedores?.nome || "—";
        const nome = cp.produtos?.nome || "—";
        const embalagem = cp.tipo_embalagem || cp.produtos?.embalagem || "un";
        if (winner) {
          insightRows.push({
            cotacaoId: cot.id,
            cotacaoNome: cot.nome,
            date: cot.created_at,
            produtoNome: nome,
            embalagem,
            fator,
            qtd,
            fornecedor,
            precoUnit: precoUnit!,
            total: total!,
          });
          allPricesByRow.set(
            `${cot.id}:${cp.id}`,
            ps.map((p: any) => Number(p.preco))
          );
        }
        return {
          id: cp.id,
          cpKey: `${cot.id}:${cp.id}`,
          nome,
          embalagem,
          fator,
          qtd,
          fornecedor,
          precoUnit,
          total,
          allPrecos: ps,
        };
      });
      // Pedidos por fornecedor for this cotação (consolidated export needs them).
      const byForn = new Map<string, { fornecedor: string; itens: any[]; total: number }>();
      for (const r of rows) {
        if (!r.fornecedor || r.fornecedor === "—") continue;
        if (!byForn.has(r.fornecedor)) byForn.set(r.fornecedor, { fornecedor: r.fornecedor, itens: [], total: 0 });
        const g = byForn.get(r.fornecedor)!;
        g.itens.push(r);
        g.total += r.total || 0;
      }
      perCotacao.set(cot.id, {
        rows,
        pedidos: Array.from(byForn.values()).sort((a, b) => b.total - a.total),
      });
    }

    return { perCotacao, insightRows, allPricesByRow };
  }, [batchDetails, batchIds, cotacoes]);

  // ===== Insights tab: derive its OWN filtered set (independent period + loja) =====
  const insightsFilteredCotacoes = useMemo(() => {
    const { start, end } = periodWindow(insightsPeriod, insightsCustomStart, insightsCustomEnd);
    const targetLoja =
      insightsLojaId === null ? lojaAtiva?.id ?? null : insightsLojaId === "all" ? null : insightsLojaId;
    return cotacoes.filter((c) => {
      const t = new Date(c.created_at).getTime();
      if (t < start || t > end) return false;
      if (targetLoja && c.loja_id !== targetLoja) return false;
      return true;
    });
  }, [cotacoes, insightsPeriod, insightsCustomStart, insightsCustomEnd, insightsLojaId, lojaAtiva?.id]);

  const insightsCotIdSet = useMemo(
    () => new Set(insightsFilteredCotacoes.map((c) => c.id)),
    [insightsFilteredCotacoes]
  );
  const insightRowsForInsights = useMemo(
    () => consolidated.insightRows.filter((r) => insightsCotIdSet.has(r.cotacaoId)),
    [consolidated.insightRows, insightsCotIdSet]
  );

  // Insights computed values (uses insightsFilteredCotacoes)
  const kpis = useMemo(() => {
    const priceLookup = new Map<string, number[]>();
    for (const [cotId, det] of consolidated.perCotacao) {
      if (!insightsCotIdSet.has(cotId)) continue;
      for (const r of det.rows) {
        if (r.precoUnit == null) continue;
        priceLookup.set(r.cpKey, r.allPrecos.map((p: any) => Number(p.preco)));
      }
    }
    let economia = 0;
    for (const r of insightRowsForInsights) {
      // find matching cpKey via lookup-set (any key starting with cotacaoId:)
      // Easier: scan perCotacao
    }
    for (const [cotId, det] of consolidated.perCotacao) {
      if (!insightsCotIdSet.has(cotId)) continue;
      for (const r of det.rows) {
        if (r.precoUnit == null) continue;
        const all = priceLookup.get(r.cpKey) || [r.precoUnit];
        if (all.length < 2) continue;
        const worst = Math.max(...all);
        const diff = worst - r.precoUnit;
        if (diff > 0) economia += diff * r.qtd * r.fator;
      }
    }
    return computeKPIs(insightsFilteredCotacoes, insightRowsForInsights, economia);
  }, [insightsFilteredCotacoes, insightRowsForInsights, consolidated, insightsCotIdSet]);

  const fornecedorRanking = useMemo(
    () => buildFornecedorRanking(insightRowsForInsights),
    [insightRowsForInsights]
  );
  const produtoVariacao = useMemo(
    () => buildProdutoVariacao(insightRowsForInsights),
    [insightRowsForInsights]
  );

  // Selection helpers
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredCotacoes.map((c) => c.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const buildConsolidated = (): { summary: ConsolidatedSummary; cotacoes: ConsolidatedCotacao[] } | null => {
    if (selectedIds.size === 0) return null;
    const list: ConsolidatedCotacao[] = [];
    let totalGeralC = 0;
    let totalProdutos = 0;
    const fornecedoresUnique = new Set<string>();
    for (const c of filteredCotacoes) {
      if (!selectedIds.has(c.id)) continue;
      const det = consolidated.perCotacao.get(c.id);
      if (!det) continue;
      const meta = {
        nome: c.nome,
        created_at: c.created_at,
        status: c.status,
        loja_nome: c.loja_nome,
        total_pedido: c.total_pedido,
        produtos_count: c.produtos_count,
        fornecedores_count: c.fornecedores_count,
      };
      list.push({ meta, rows: det.rows as any, pedidos: det.pedidos as any });
      totalGeralC += det.rows.reduce((a: number, r: any) => a + (r.total || 0), 0);
      totalProdutos += det.rows.length;
      for (const g of det.pedidos) fornecedoresUnique.add(g.fornecedor);
    }
    if (list.length === 0) return null;
    const summary: ConsolidatedSummary = {
      periodoLabel: periodLabel(periodFilter),
      lojaLabel: lojaFilter === "active" ? lojaAtiva?.nome ?? null : "Todas as lojas",
      totalGeral: totalGeralC,
      totalCotacoes: list.length,
      totalProdutos,
      totalFornecedores: fornecedoresUnique.size,
    };
    return { summary, cotacoes: list };
  };

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
              <DropdownMenuItem
                onSelect={() => {
                  setActiveTab("cotacoes");
                  setSelectionMode(true);
                  setExpandedCotacao(null);
                }}
              >
                <CheckSquare className="h-4 w-4 mr-2" /> Selecionar para consolidar
              </DropdownMenuItem>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="cotacoes" className="flex-1 text-xs">Por Cotação</TabsTrigger>
          <TabsTrigger value="insights" className="flex-1 text-xs">
            <BarChart3 className="h-3.5 w-3.5 mr-1" /> Insights
          </TabsTrigger>
          <TabsTrigger value="itens" className="flex-1 text-xs">Buscar Item</TabsTrigger>
        </TabsList>

        <TabsContent value="cotacoes" className="space-y-4">
          {/* Selection mode bar */}
          {selectionMode && (
            <div className="sticky top-0 z-20 -mx-4 md:mx-0 px-4 md:px-3 py-2.5 md:rounded-xl bg-primary/95 backdrop-blur text-primary-foreground shadow-md flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={exitSelectionMode}
                aria-label="Sair do modo seleção"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">
                  {selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}
                </div>
                <div className="text-[10px] opacity-80 truncate">
                  Toque nas cotações para selecionar
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-primary-foreground hover:bg-primary-foreground/20"
                onClick={selectedIds.size === filteredCotacoes.length ? clearSelection : selectAllVisible}
              >
                {selectedIds.size === filteredCotacoes.length ? "Limpar" : "Todas"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={selectedIds.size === 0 || batchLoading}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Exportar
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      const data = buildConsolidated();
                      if (!data) return;
                      try {
                        exportConsolidadoToExcel(data.summary, data.cotacoes);
                      } catch (e: any) {
                        toast.error("Erro ao exportar Excel: " + e.message);
                      }
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel consolidado
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      const data = buildConsolidated();
                      if (!data) return;
                      try {
                        await exportConsolidadoToPdf(data.summary, data.cotacoes);
                      } catch (e: any) {
                        toast.error("Erro ao gerar PDF: " + e.message);
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" /> PDF consolidado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Search + filters trigger */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cotação por nome..."
                value={searchCotacao}
                onChange={(e) => setSearchCotacao(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0 relative">
                  <Filter className="h-4 w-4" />
                  <span className="text-xs font-medium">Filtros</span>
                  {activeFiltersCount > 0 && (
                    <Badge
                      variant="default"
                      className="h-4 min-w-4 px-1 text-[10px] rounded-full ml-0.5"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>
                    Refine o histórico de cotações.
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-6">
                  {/* Período */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Período
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["7d", "30d", "90d", "all"] as PeriodFilter[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriodFilter(p)}
                          className={`text-sm px-3 py-2 rounded-lg font-medium border transition-colors ${
                            periodFilter === p
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-input hover:bg-muted"
                          }`}
                        >
                          {periodLabel(p)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["all", "finalizada", "cancelada"] as StatusFilter[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`text-sm px-3 py-2 rounded-lg font-medium border transition-colors ${
                            statusFilter === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-input hover:bg-muted"
                          }`}
                        >
                          {statusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loja */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Loja
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setLojaFilter("active")}
                        className={`text-sm px-3 py-2.5 rounded-lg font-medium border transition-colors text-left flex items-center gap-2 ${
                          lojaFilter === "active"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                      >
                        <Store className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          Loja selecionada
                          {lojaAtiva ? ` · ${lojaAtiva.nome}` : ""}
                        </span>
                      </button>
                      <button
                        onClick={() => setLojaFilter("all")}
                        className={`text-sm px-3 py-2.5 rounded-lg font-medium border transition-colors text-left flex items-center gap-2 ${
                          lojaFilter === "all"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                      >
                        <Store className="h-4 w-4 shrink-0" />
                        <span>Todas as lojas</span>
                      </button>
                    </div>
                  </div>
                </div>

                <SheetFooter className="flex-row gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setPeriodFilter(DEFAULT_PERIOD);
                      setStatusFilter(DEFAULT_STATUS);
                      setLojaFilter(DEFAULT_LOJA);
                    }}
                    disabled={activeFiltersCount === 0}
                  >
                    Limpar
                  </Button>
                  <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                    Aplicar
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Active filter chips summary */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Filtros ativos:</span>
              {periodFilter !== DEFAULT_PERIOD && (
                <Badge variant="secondary" className="font-normal">
                  Período: {periodLabel(periodFilter)}
                </Badge>
              )}
              {statusFilter !== DEFAULT_STATUS && (
                <Badge variant="secondary" className="font-normal">
                  Status: {statusLabel(statusFilter)}
                </Badge>
              )}
              {lojaFilter !== DEFAULT_LOJA && (
                <Badge variant="secondary" className="font-normal">
                  Todas as lojas
                </Badge>
              )}
            </div>
          )}

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
                const isOpen = !selectionMode && expandedCotacao === c.id;
                const isSelected = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-colors ${
                      selectionMode && isSelected ? "border-primary ring-2 ring-primary/30" : ""
                    }`}
                  >
                    {/* Card compacto */}
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => (selectionMode ? toggleSelected(c.id) : toggleExpand(c.id))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {selectionMode && (
                          <div className="pt-0.5">
                            <Checkbox checked={isSelected} aria-label="Selecionar cotação" />
                          </div>
                        )}
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

                            {/* Toolbar de exportação */}
                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => {
                                  const meta = {
                                    nome: c.nome, created_at: c.created_at, status: c.status,
                                    loja_nome: c.loja_nome, total_pedido: c.total_pedido,
                                    produtos_count: c.produtos_count, fornecedores_count: c.fornecedores_count,
                                  };
                                  exportCotacaoToExcel(meta, tableRows, pedidosByFornecedor);
                                }}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={async () => {
                                  const meta = {
                                    nome: c.nome, created_at: c.created_at, status: c.status,
                                    loja_nome: c.loja_nome, total_pedido: c.total_pedido,
                                    produtos_count: c.produtos_count, fornecedores_count: c.fornecedores_count,
                                  };
                                  try {
                                    await exportCotacaoToPdf(meta, tableRows, pedidosByFornecedor);
                                  } catch (e: any) {
                                    toast.error("Erro ao gerar PDF: " + e.message);
                                  }
                                }}
                              >
                                <FileText className="h-3.5 w-3.5" /> PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => {
                                  const meta = {
                                    nome: c.nome, created_at: c.created_at, status: c.status,
                                    loja_nome: c.loja_nome, total_pedido: c.total_pedido,
                                    produtos_count: c.produtos_count, fornecedores_count: c.fornecedores_count,
                                  };
                                  printCotacao(meta, tableRows, pedidosByFornecedor);
                                }}
                              >
                                <Printer className="h-3.5 w-3.5" /> Imprimir
                              </Button>
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

        <TabsContent value="insights" className="space-y-4">
          {/* Insights filters bar — always visible */}
          <InsightsFilters
            period={insightsPeriod}
            setPeriod={setInsightsPeriod}
            customStart={insightsCustomStart}
            customEnd={insightsCustomEnd}
            setCustomStart={setInsightsCustomStart}
            setCustomEnd={setInsightsCustomEnd}
            lojaId={insightsLojaId}
            setLojaId={setInsightsLojaId}
            lojas={lojas}
            lojaAtivaNome={lojaAtiva?.nome}
            cotacoesCount={kpis.cotacoes}
            periodLabel={periodLabel}
          />
          {cotacoes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Sem cotações no histórico.
            </div>
          ) : batchLoading || !batchDetails ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : insightsFilteredCotacoes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Sem cotações no período/loja selecionados.
            </div>
          ) : (
            <>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
                <div className="bg-card border rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide">
                    <DollarSign className="h-3 w-3" /> Total no período
                  </div>
                  <div className="text-base md:text-lg font-bold text-primary mt-1 break-words">
                    {formatBRL(kpis.totalGeral)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Ticket médio: {formatBRL(kpis.ticketMedio)}
                  </div>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide">
                    <Sparkles className="h-3 w-3" /> Economia estimada
                  </div>
                  <div className="text-base md:text-lg font-bold text-green-600 dark:text-green-400 mt-1 break-words">
                    {formatBRL(kpis.economiaEstimada)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">vs. piores preços recebidos</div>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide">
                    <Package className="h-3 w-3" /> Produtos únicos
                  </div>
                  <div className="text-base md:text-lg font-bold text-foreground mt-1">
                    {kpis.produtosUnicos}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">cotados no período</div>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide">
                    <Users className="h-3 w-3" /> Fornecedores
                  </div>
                  <div className="text-base md:text-lg font-bold text-foreground mt-1">
                    {kpis.fornecedoresUnicos}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">venceram pelo menos 1 item</div>
                </div>
              </div>

              {/* Ranking de fornecedores */}
              <TooltipProvider delayDuration={150}>
              <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold">Ranking de fornecedores</h2>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button aria-label="Como funciona o ranking" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                      <strong>Taxa de vitória</strong> = vitórias do fornecedor ÷ cotações em que participou × 100.
                      Ex: ganhou 8 itens em 2 cotações onde participou ⇒ 8/2 = 400% (média de itens por cotação).
                      Use junto com "Vitórias" e "Total ganho" para julgar competitividade.
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    Por valor total ganho
                  </span>
                </div>
                {fornecedorRanking.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Sem dados de vencedores no período.
                  </div>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                            <th className="px-3 py-2 text-left font-semibold">Fornecedor</th>
                            <th className="px-3 py-2 text-center font-semibold">Vitórias</th>
                            <th className="px-3 py-2 text-center font-semibold">Cotações</th>
                            <th className="px-3 py-2 text-right font-semibold">Taxa</th>
                            <th className="px-3 py-2 text-right font-semibold">Total ganho</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fornecedorRanking.slice(0, 20).map((f, idx) => (
                            <tr key={f.nome} className="border-t hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  {idx === 0 && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
                                  {f.nome}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">{f.vitorias}</td>
                              <td className="px-3 py-2 text-center text-muted-foreground">{f.totalCotacoes}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {f.taxa.toFixed(0)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-primary">
                                {formatBRL(f.totalGanho)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden divide-y">
                      {fornecedorRanking.slice(0, 20).map((f, idx) => (
                        <div key={f.nome} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground font-mono w-5">
                                  {idx + 1}
                                </span>
                                {idx === 0 && <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                                <span className="text-sm font-semibold truncate">{f.nome}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground ml-6">
                                {f.vitorias} vitória(s) · {f.totalCotacoes} cotação(ões) · {f.taxa.toFixed(0)}%
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-bold text-sm text-primary">
                                {formatBRL(f.totalGanho)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Variação de preço por produto */}
              <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold">Variação de preço por produto</h2>
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    Maior variação primeiro
                  </span>
                </div>
                {produtoVariacao.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Sem dados suficientes.
                  </div>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden md:block">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Produto</th>
                            <th className="px-3 py-2 text-center font-semibold">Amostras</th>
                            <th className="px-3 py-2 text-right font-semibold">Mín</th>
                            <th className="px-3 py-2 text-right font-semibold">Médio</th>
                            <th className="px-3 py-2 text-right font-semibold">Máx</th>
                            <th className="px-3 py-2 text-right font-semibold">Variação</th>
                            <th className="px-3 py-2 text-right font-semibold">Último</th>
                          </tr>
                        </thead>
                        <tbody>
                          {produtoVariacao.slice(0, 30).map((p) => {
                            const high = (p.variacaoPct ?? 0) >= 30;
                            const single = p.amostras < 2;
                            if (single) {
                              return (
                                <tr key={p.produto} className="border-t hover:bg-muted/20">
                                  <td className="px-3 py-2">
                                    <div className="font-medium">{p.produto}</div>
                                    <div className="text-[10px] text-muted-foreground">{p.embalagem}</div>
                                  </td>
                                  <td className="px-3 py-2 text-center text-muted-foreground">{p.amostras}</td>
                                  <td colSpan={4} className="px-3 py-2 text-xs italic text-muted-foreground">
                                    Apenas 1 cotação — sem variação disponível
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="font-mono text-xs">{formatBRL(p.ultimoPreco)}</div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                      {p.ultimoFornecedor}
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={p.produto} className="border-t hover:bg-muted/20">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{p.produto}</div>
                                  <div className="text-[10px] text-muted-foreground">{p.embalagem}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-muted-foreground">{p.amostras}</td>
                                <td className="px-3 py-2 text-right font-mono text-green-700 dark:text-green-400">
                                  {formatBRL(p.precoMin)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                  {formatBRL(p.precoMedio)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">
                                  {formatBRL(p.precoMax)}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${
                                  high ? "text-red-600 dark:text-red-400" : "text-foreground"
                                }`}>
                                  {p.variacaoPct != null ? `${p.variacaoPct.toFixed(1)}%` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="font-mono text-xs">{formatBRL(p.ultimoPreco)}</div>
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                    {p.ultimoFornecedor}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden divide-y">
                      {produtoVariacao.slice(0, 30).map((p) => {
                        const high = (p.variacaoPct ?? 0) >= 30;
                        const single = p.amostras < 2;
                        return (
                          <div key={p.produto} className="px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate">{p.produto}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {p.embalagem} · {p.amostras} amostra(s)
                                </div>
                              </div>
                              {!single && (
                                <div className={`text-xs font-mono font-bold shrink-0 ${
                                  high ? "text-red-600 dark:text-red-400" : "text-foreground"
                                }`}>
                                  {p.variacaoPct != null ? `${p.variacaoPct.toFixed(0)}%` : "—"}
                                </div>
                              )}
                            </div>
                            {single ? (
                              <div className="mt-2 text-[11px] italic text-muted-foreground">
                                Apenas 1 cotação — sem variação disponível
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
                                <div className="bg-green-500/10 rounded px-1.5 py-1">
                                  <div className="text-green-700 dark:text-green-400 font-mono font-semibold">
                                    {formatBRL(p.precoMin)}
                                  </div>
                                  <div className="text-muted-foreground">Mín</div>
                                </div>
                                <div className="bg-muted/30 rounded px-1.5 py-1">
                                  <div className="text-foreground font-mono font-semibold">
                                    {formatBRL(p.precoMedio)}
                                  </div>
                                  <div className="text-muted-foreground">Médio</div>
                                </div>
                                <div className="bg-red-500/10 rounded px-1.5 py-1">
                                  <div className="text-red-600 dark:text-red-400 font-mono font-semibold">
                                    {formatBRL(p.precoMax)}
                                  </div>
                                  <div className="text-muted-foreground">Máx</div>
                                </div>
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                              Último: {formatBRL(p.ultimoPreco)} · {p.ultimoFornecedor}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              </TooltipProvider>
            </>
          )}
        </TabsContent>

        <TabsContent value="itens" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto (ex: Detergente)..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setItemViewMode("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  itemViewMode === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos os preços
              </button>
              <button
                type="button"
                onClick={() => setItemViewMode("best")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1 ${
                  itemViewMode === "best"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Trophy className="h-3 w-3" /> Melhor preço
              </button>
            </div>
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
              // Group by product name
              const grouped: Record<string, { nome: string; embalagem: string; entries: any[] }> = {};
              itemSearchResults.forEach((item: any) => {
                const key = item.produtos?.nome || "?";
                if (!grouped[key]) grouped[key] = { nome: key, embalagem: item.produtos?.embalagem || "un", entries: [] };
                grouped[key].entries.push(item);
              });

              // Build extract rows: one row per (cotacao item × supplier price)
              type ExtractRow = {
                id: string;
                date: string;
                cotacaoNome: string;
                fornecedor: string;
                embalagem: string;
                fator: number;
                qtd: number;
                preco: number;
                total: number;
                isMin: boolean;
              };

              return Object.values(grouped).map((group) => {
                const rows: ExtractRow[] = [];
                for (const cp of group.entries) {
                  const qtd = Number(cp.quantidade || 1);
                  const fator = Number(cp.fator_embalagem || 1);
                  const embalagem = cp.tipo_embalagem || group.embalagem;
                  const validPrecos = (cp.precos || []).filter((p: any) => Number(p.preco) > 0);
                  const minPreco = validPrecos.length
                    ? Math.min(...validPrecos.map((p: any) => Number(p.preco)))
                    : null;
                  for (const p of validPrecos) {
                    const preco = Number(p.preco);
                    rows.push({
                      id: p.id,
                      date: cp.cotacoes?.created_at || "",
                      cotacaoNome: cp.cotacoes?.nome || "—",
                      fornecedor: p.fornecedores?.nome || "—",
                      embalagem,
                      fator,
                      qtd,
                      preco,
                      total: preco * qtd * fator,
                      isMin: preco === minPreco,
                    });
                  }
                }
                // Sort: by date desc, then by price asc within the same cotação
                // (so suppliers within a cotação go cheapest → priciest).
                rows.sort((a, b) => {
                  const d = b.date.localeCompare(a.date);
                  if (d !== 0) return d;
                  if (a.cotacaoNome !== b.cotacaoNome) return a.cotacaoNome.localeCompare(b.cotacaoNome);
                  return a.preco - b.preco;
                });

                // In "best" mode, keep only the winner per cotação
                const displayRows =
                  itemViewMode === "best" ? rows.filter((r) => r.isMin) : rows;

                const visibleN = itemVisibleByGroup[group.nome] ?? ITEM_PAGE_SIZE;
                const visibleRows = displayRows.slice(0, visibleN);
                const remaining = displayRows.length - visibleRows.length;
                const isExpanded = !!expandedGroups[group.nome];

                return (
                  <div key={group.nome} className="bg-card border rounded-xl shadow-sm overflow-hidden mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({ ...prev, [group.nome]: !prev[group.nome] }))
                      }
                      className="w-full px-4 py-3 bg-muted/30 border-b flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors text-left"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-foreground truncate">{group.nome}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {group.embalagem} · {displayRows.length} registro(s)
                          {itemViewMode === "best" && rows.length !== displayRows.length && (
                            <span className="text-muted-foreground/70"> (de {rows.length})</span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      displayRows.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          {itemViewMode === "best"
                            ? "Sem cotação com vencedor."
                            : "Sem preços registrados."}
                        </div>
                      ) : (
                      <>
                        {/* Desktop / wide: table */}
                        <div className="hidden md:block">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Data</th>
                                <th className="px-3 py-2 text-left font-semibold">Fornecedor</th>
                                <th className="px-3 py-2 text-left font-semibold">Embalagem</th>
                                <th className="px-3 py-2 text-center font-semibold">Qtd</th>
                                <th className="px-3 py-2 text-right font-semibold">Preço un.</th>
                                <th className="px-3 py-2 text-right font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map((r) => (
                                <tr
                                  key={r.id}
                                  className={`border-t hover:bg-muted/20 ${r.isMin ? "bg-green-500/5" : ""}`}
                                >
                                  <td className="px-3 py-2">
                                    <div className="text-xs font-medium text-foreground">{formatDateTime(r.date)}</div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.cotacaoNome}</div>
                                  </td>
                                  <td className="px-3 py-2 text-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      {r.isMin && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
                                      <span className={r.isMin ? "font-semibold" : ""}>{r.fornecedor}</span>
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground text-xs">
                                    {r.embalagem} {r.fator > 1 && <span className="text-[10px]">×{r.fator}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center">{r.qtd}</td>
                                  <td className={`px-3 py-2 text-right font-mono ${r.isMin ? "text-green-700 dark:text-green-400 font-bold" : ""}`}>
                                    {formatBRL(r.preco)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.isMin ? "text-green-700 dark:text-green-400" : ""}`}>
                                    {formatBRL(r.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile: stacked rows */}
                        <div className="md:hidden divide-y">
                          {visibleRows.map((r) => (
                            <div
                              key={r.id}
                              className={`px-3 py-2.5 ${r.isMin ? "bg-green-500/5" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="text-[11px] font-medium text-muted-foreground">
                                  {formatDateTime(r.date)}
                                </div>
                                {r.isMin && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">
                                    <Trophy className="h-2.5 w-2.5" /> Menor
                                  </span>
                                )}
                              </div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className={`text-sm truncate ${r.isMin ? "font-semibold text-foreground" : "text-foreground"}`}>
                                    {r.fornecedor}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {r.embalagem}{r.fator > 1 ? ` ×${r.fator}` : ""} · Qtd {r.qtd} · {r.cotacaoNome}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className={`font-mono text-sm ${r.isMin ? "text-green-700 dark:text-green-400 font-bold" : "text-foreground"}`}>
                                    {formatBRL(r.preco)}
                                  </div>
                                  <div className={`font-mono text-[11px] ${r.isMin ? "text-green-700 dark:text-green-400 font-semibold" : "text-muted-foreground"}`}>
                                    Σ {formatBRL(r.total)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {remaining > 0 && (
                          <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              Mostrando {visibleRows.length} de {displayRows.length}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setItemVisibleByGroup((prev) => ({
                                    ...prev,
                                    [group.nome]: (prev[group.nome] ?? ITEM_PAGE_SIZE) + ITEM_PAGE_SIZE,
                                  }))
                                }
                              >
                                Carregar mais ({Math.min(ITEM_PAGE_SIZE, remaining)})
                              </Button>
                              {remaining > ITEM_PAGE_SIZE && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    setItemVisibleByGroup((prev) => ({ ...prev, [group.nome]: displayRows.length }))
                                  }
                                >
                                  Ver todos
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                      )
                    )}
                  </div>
                );
              });
            })()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoPage;
