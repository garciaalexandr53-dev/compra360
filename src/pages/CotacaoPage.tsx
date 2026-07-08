import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, Save, RefreshCw, FileWarning, Filter, Users, Sparkles, Wand2, MoreHorizontal, FileSpreadsheet, RotateCcw, Copy, HelpCircle, ClipboardCopy, Trash2, Target, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatBRL, formatNumber } from "@/lib/format";
import * as XLSX from "xlsx";
import ImportErpModal from "@/components/ImportErpModal";
import ModalNovaCotacao from "@/components/cotacao/ModalNovaCotacao";
import ModalFornecedores from "@/components/cotacao/ModalFornecedores";
import ModalAiAnalise from "@/components/cotacao/ModalAiAnalise";
import ModalQtySugestao from "@/components/cotacao/ModalQtySugestao";
import ModalFornecedorSugestao from "@/components/cotacao/ModalFornecedorSugestao";
import TabelaCotacao from "@/components/cotacao/TabelaCotacao";
import { getCotacaoNome, getCotacaoEmbalagem } from "@/lib/buscaProdutos";
import { buildUndoInsert } from "@/lib/undoCotacaoProduto";
import ReviewHeader from "@/components/cotacao/ReviewHeader";
import ReviewFooter from "@/components/cotacao/ReviewFooter";

import StatusFornecedorBadge, { type FornecedorVisualStatus } from "@/components/cotacao/StatusFornecedorBadge";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";
import BackToLojaButton from "@/components/shared/BackToLojaButton";

type Fornecedor = Tables<"fornecedores">;
type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };

interface CotacaoProduto { id: string; produto_id: string | null; catalogo_mestre_id?: string | null; cotacao_id: string; quantidade: number | null; fator_embalagem: number; tipo_embalagem: string | null; nome?: string | null; ean?: string | null; produto?: Produto; }
interface Preco { id: string; cotacao_produto_id: string; fornecedor_id: string; preco: number | null; }

const HIST_HIGH_THRESHOLD = 0.40; // 40% acima da média histórica
const HIST_LOW_THRESHOLD = 0.30;  // 30% abaixo da média histórica
const MIN_HIST_QUOTES = 2;       // mínimo de cotações anteriores para análise

const CotacaoPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const { checkPlan, showPlanos, setShowPlanos } = useFeatureCheck();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isReviewMode = searchParams.get("review") === "1";
  const isFromDashboard = searchParams.get("from") === "dashboard" || isReviewMode;
  const [search, setSearch] = useState("");
  const [localPrices, setLocalPrices] = useState<Record<string, Record<string, string>>>({});
  const [novaCotacaoOpen, setNovaCotacaoOpen] = useState(false);
  const [novaCotacaoOpt, setNovaCotacaoOpt] = useState<"manter" | "manter_precos" | "zerar" | null>(null);
  const [legendVisible, setLegendVisible] = useState(false);
  const [filterAnomalies, setFilterAnomalies] = useState(false);
  const [filterSemPreco, setFilterSemPreco] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [qtySuggestLoading, setQtySuggestLoading] = useState(false);
  const [qtySuggestions, setQtySuggestions] = useState<{ cotacao_produto_id: string; nome: string; quantidade_sugerida: number; justificativa: string; tendencia?: "crescente" | "estável" | "diminuindo" | "sem_historico"; comparativo_lojas?: string }[]>([]);
  const [qtySuggestOpen, setQtySuggestOpen] = useState(false);
  const [qtySuggestLojaNome, setQtySuggestLojaNome] = useState("");
  const [qtySuggestMultiStore, setQtySuggestMultiStore] = useState(false);
  const [erpImportOpen, setErpImportOpen] = useState(false);
  const [cancelCotacaoOpen, setCancelCotacaoOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelOpt, setCancelOpt] = useState<"manter" | "excluir_tudo">("manter");
  const [skipPendingOpen, setSkipPendingOpen] = useState(false);
  const [skipPendingLoading, setSkipPendingLoading] = useState(false);
  const [fornSuggestOpen, setFornSuggestOpen] = useState(false);
  const [fornSuggestText, setFornSuggestText] = useState("");
  const [fornSuggestLoading, setFornSuggestLoading] = useState(false);
  const [fornSuggestHasHistory, setFornSuggestHasHistory] = useState(false);
  const [fornSuggestRecommendedIds, setFornSuggestRecommendedIds] = useState<string[]>([]);

  // Toggle legend with localStorage persistence
  const toggleLegend = () => {
    setLegendVisible((prev) => {
      const next = !prev;
      try { localStorage.setItem("cotacao-legend", next ? "visible" : "hidden"); } catch {}
      return next;
    });
  };

  // ── Queries ──
  const { data: cotacaoAtiva, isFetched: cotacaoFetched } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: importedItemsCount = 0 } = useQuery({
    queryKey: ["imported-items-count", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase
        .from("itens_faltantes")
        .select("id", { count: "exact", head: true })
        .eq("importado", true);
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      const { count } = await query;
      return count || 0;
    },
  });

  const { data: fornecedorLojas = [] } = useQuery({
    queryKey: ["fornecedor-lojas"],
    queryFn: async () => { const { data, error } = await supabase.from("fornecedor_lojas").select("*"); if (error) throw error; return data; },
  });

  const { data: allFornecedoresRaw = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => { const { data, error } = await supabase.from("fornecedores").select("*").order("nome"); if (error) throw error; return data as Fornecedor[]; },
  });

  const allFornecedores = useMemo(() => {
    if (!lojaAtiva?.id) return allFornecedoresRaw;
    const linkedToStore = new Set(fornecedorLojas.filter((fl: any) => fl.loja_id === lojaAtiva.id).map((fl: any) => fl.fornecedor_id));
    const allLinkedIds = new Set(fornecedorLojas.map((fl: any) => fl.fornecedor_id));
    return allFornecedoresRaw.filter((f) => linkedToStore.has(f.id) || !allLinkedIds.has(f.id));
  }, [allFornecedoresRaw, fornecedorLojas, lojaAtiva?.id]);

  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => { const { data, error } = await supabase.from("cotacao_fornecedores").select("fornecedor_id, visualizado_em, status_envio").eq("cotacao_id", cotacaoAtiva!.id); if (error) throw error; return data || []; },
  });

  const visualizadoMap = useMemo(() => {
    const m = new Map<string, string | null>();
    cotacaoFornecedores.forEach((cf: any) => m.set(cf.fornecedor_id, cf.visualizado_em || null));
    return m;
  }, [cotacaoFornecedores]);

  useEffect(() => {
    if (!allFornecedores.length || !cotacaoAtiva?.id) return;
    if (cotacaoFornecedores.length > 0) {
      const sel: Record<string, boolean> = {};
      allFornecedores.forEach((f) => { sel[f.id] = false; });
      cotacaoFornecedores.forEach((cf: any) => { sel[cf.fornecedor_id] = true; });
      setSelectedSuppliers((prev) => {
        const prevKeys = Object.keys(prev).sort().join(",");
        const newKeys = Object.keys(sel).sort().join(",");
        if (prevKeys === newKeys && Object.values(prev).join(",") === Object.values(sel).join(",")) return prev;
        return sel;
      });
    } else {
      setSelectedSuppliers((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, boolean> = {};
        allFornecedores.forEach((f) => { initial[f.id] = true; });
        return initial;
      });
    }
  }, [allFornecedores, cotacaoFornecedores, cotacaoAtiva?.id]);

  const fornecedores = useMemo(() => allFornecedores.filter((f) => selectedSuppliers[f.id] !== false), [allFornecedores, selectedSuppliers]);

  const { data: cotacaoProdutos = [] } = useQuery({
    queryKey: ["cotacao-produtos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cotacao_produtos").select("*, produtos(*, categorias(nome))").eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return (data || []).map((cp: any) => ({ id: cp.id, produto_id: cp.produto_id, catalogo_mestre_id: cp.catalogo_mestre_id ?? null, cotacao_id: cp.cotacao_id, quantidade: cp.quantidade, fator_embalagem: cp.fator_embalagem ?? 1, tipo_embalagem: cp.tipo_embalagem ?? null, nome: cp.nome ?? null, ean: cp.ean ?? null, produto: cp.produtos })) as CotacaoProduto[];
    },
  });

  const { data: precos = [] } = useQuery({
    queryKey: ["precos", cotacaoAtiva?.id, cotacaoProdutos.map(cp => cp.id).join(",")],
    enabled: !!cotacaoAtiva?.id && cotacaoProdutos.length > 0,
    queryFn: async () => {
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (!cpIds.length) return [];
      const { data, error } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      if (error) throw error;
      return data as Preco[];
    },
  });

  // Fetch avg prices from last 3 finalized quotes per product
  const { data: historicalAvgMap = {} } = useQuery<Record<string, { avg: number; count: number }>>({
    queryKey: ["historical-avg-prices", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id && cotacaoProdutos.length > 0,
    queryFn: async () => {
      const produtoIds = cotacaoProdutos.map((cp) => cp.produto_id);
      if (!produtoIds.length) return {};
      // Get last 3 finalized quotes (excluding current)
      const { data: lastCots } = await supabase
        .from("cotacoes").select("id")
        .neq("status", "ativa")
        .order("finalizada_at", { ascending: false })
        .limit(3);
      if (!lastCots?.length) return {};
      const cotIds = lastCots.map((c: any) => c.id);
      // Get cotacao_produtos for those quotes
      const { data: oldCps } = await supabase
        .from("cotacao_produtos").select("id, produto_id, cotacao_id")
        .in("cotacao_id", cotIds)
        .in("produto_id", produtoIds);
      if (!oldCps?.length) return {};
      // Get prices
      const { data: oldPrecos } = await supabase
        .from("precos").select("cotacao_produto_id, preco")
        .in("cotacao_produto_id", oldCps.map((cp: any) => cp.id))
        .gt("preco", 0);
      if (!oldPrecos?.length) return {};
      // Build avg map: produto_id -> { avg, count (number of distinct quotes with data) }
      const prodPrices: Record<string, { sum: number; n: number; quotesWithData: Set<string> }> = {};
      oldPrecos.forEach((p: any) => {
        const cp = oldCps.find((c: any) => c.id === p.cotacao_produto_id);
        if (!cp || p.preco === null) return;
        if (!prodPrices[cp.produto_id]) prodPrices[cp.produto_id] = { sum: 0, n: 0, quotesWithData: new Set() };
        prodPrices[cp.produto_id].sum += Number(p.preco);
        prodPrices[cp.produto_id].n += 1;
        prodPrices[cp.produto_id].quotesWithData.add(cp.cotacao_id);
      });
      const result: Record<string, { avg: number; count: number }> = {};
      Object.entries(prodPrices).forEach(([pid, d]) => {
        if (d.quotesWithData.size >= MIN_HIST_QUOTES) {
          result[pid] = { avg: d.sum / d.n, count: d.quotesWithData.size };
        }
      });
      return result;
    },
  });

  const priceMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    precos.forEach((p) => { if (!map[p.cotacao_produto_id]) map[p.cotacao_produto_id] = {}; map[p.cotacao_produto_id][p.fornecedor_id] = p.preco; });
    return map;
  }, [precos]);

  // Realtime — precos (INSERT/UPDATE from suppliers)
  // IMPORTANTE: As tabelas precos e cotacao_produtos devem ter Realtime habilitado no Supabase
  useEffect(() => {
    if (!cotacaoAtiva?.id) return;
    const channel = supabase.channel('precos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'precos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["precos", cotacaoAtiva.id] });
        toast.info("💬 Novo preço recebido de fornecedor", { duration: 4000 });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'precos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["precos", cotacaoAtiva.id] });
        toast.info("💬 Novo preço recebido de fornecedor", { duration: 4000 });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cotacaoAtiva?.id, queryClient]);

  // Realtime — cotacao_produtos (INSERT/DELETE)
  useEffect(() => {
    if (!cotacaoAtiva?.id) return;
    const channel = supabase.channel('cotacao-produtos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cotacao_produtos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-produtos", cotacaoAtiva.id] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cotacao_produtos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-produtos", cotacaoAtiva.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cotacaoAtiva?.id, queryClient]);

  // Realtime — cotacao_fornecedores (visualizado_em) + cotacoes (prazo_resposta)
  useEffect(() => {
    if (!cotacaoAtiva?.id) return;
    const channel = supabase.channel('cotacao-meta-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotacao_fornecedores', filter: `cotacao_id=eq.${cotacaoAtiva.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores", cotacaoAtiva.id] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cotacoes', filter: `id=eq.${cotacaoAtiva.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cotacaoAtiva?.id, queryClient]);

  useEffect(() => {
    const lp: Record<string, Record<string, string>> = {};
    cotacaoProdutos.forEach((cp) => { lp[cp.id] = {}; fornecedores.forEach((f) => { const val = priceMap[cp.id]?.[f.id]; lp[cp.id][f.id] = val !== null && val !== undefined ? formatNumber(val) : ""; }); });
    setLocalPrices(lp);
  }, [cotacaoProdutos, fornecedores, priceMap]);

  // ── Mutations ──
  const savePriceMutation = useMutation({
    mutationFn: async ({ cpId, fornecedorId, preco }: { cpId: string; fornecedorId: string; preco: number | null }) => {
      const existing = precos.find((p) => p.cotacao_produto_id === cpId && p.fornecedor_id === fornecedorId);
      if (existing) { const { error } = await supabase.from("precos").update({ preco }).eq("id", existing.id); if (error) throw error; }
      else if (preco !== null) { const { error } = await supabase.from("precos").insert({ cotacao_produto_id: cpId, fornecedor_id: fornecedorId, preco }); if (error) throw error; }
    },
  });

  const updateCpMutation = useMutation({
    mutationFn: async ({ cpId, field, value }: { cpId: string; field: string; value: any }) => {
      if (field === "quantidade") { const { error } = await supabase.from("cotacao_produtos").update({ quantidade: value }).eq("id", cpId); if (error) throw error; }
      else if (field === "fator") { const { error } = await supabase.from("cotacao_produtos").update({ fator_embalagem: value }).eq("id", cpId); if (error) throw error; }
      else if (field === "embalagem") { const { error } = await supabase.from("cotacao_produtos").update({ tipo_embalagem: value }).eq("id", cpId); if (error) throw error; }
      else if (field === "nome") { const cp = cotacaoProdutos.find(c => c.id === cpId); if (cp?.produto_id) { const { error } = await supabase.from("produtos").update({ [field]: value }).eq("id", cp.produto_id); if (error) throw error; } }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] }); queryClient.invalidateQueries({ queryKey: ["produtos"] }); },
  });

  const lastDeletedRef = useRef<{
    snapshot: import("@/lib/undoCotacaoProduto").UndoCotacaoProdutoSnapshot;
    precos: { cotacao_produto_id: string; fornecedor_id: string; preco: number | null }[];
  } | null>(null);

  const deleteCpMutation = useMutation({
    mutationFn: async (cpId: string) => {
      // Save FULL snapshot for undo — nome/ean/catalogo_mestre_id/embalagem/fator
      // devem ser preservados porque cotacao_produtos.nome é NOT NULL e o item
      // pode vir do catálogo global (sem produto_id).
      const cp = cotacaoProdutos?.find((c: any) => c.id === cpId);
      const cpPrecos = precos?.filter((p: any) => p.cotacao_produto_id === cpId) || [];
      if (cp) {
        lastDeletedRef.current = {
          snapshot: {
            cpId: cp.id,
            cotacao_id: cp.cotacao_id,
            produto_id: cp.produto_id ?? null,
            catalogo_mestre_id: cp.catalogo_mestre_id ?? null,
            nome: cp.nome ?? (cp as any).produto?.nome ?? (cp as any).produtos?.nome ?? "",
            ean: cp.ean ?? null,
            tipo_embalagem: cp.tipo_embalagem ?? null,
            fator_embalagem: cp.fator_embalagem ?? null,
            quantidade: cp.quantidade ?? null,
          },
          precos: cpPrecos.map((p: any) => ({ cotacao_produto_id: p.cotacao_produto_id, fornecedor_id: p.fornecedor_id, preco: p.preco })),
        };
      }
      await supabase.from("precos").delete().eq("cotacao_produto_id", cpId);
      const { error } = await supabase.from("cotacao_produtos").delete().eq("id", cpId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
      toast.success("Produto removido da cotação", {
        action: {
          label: "Desfazer",
          onClick: async () => {
            const saved = lastDeletedRef.current;
            if (!saved) return;
            const payload = buildUndoInsert(saved.snapshot);
            const { error: cpErr } = await supabase.from("cotacao_produtos").insert(payload as any);
            if (cpErr) {
              console.error("[undo cotacao_produto] insert falhou", { payload, cpErr });
              toast.error(`Erro ao desfazer: ${cpErr.message}`);
              return;
            }
            if (saved.precos.length) {
              await supabase.from("precos").insert(
                saved.precos.map((p) => ({ cotacao_produto_id: saved.snapshot.cpId, fornecedor_id: p.fornecedor_id, preco: p.preco }))
              );
            }
            lastDeletedRef.current = null;
            queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
            queryClient.invalidateQueries({ queryKey: ["precos"] });
            toast.success("Produto restaurado!");
          },
        },
        duration: 8000,
      });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover produto"),
  });

  const handleDeleteItem = (cpId: string) => { deleteCpMutation.mutate(cpId); };

  // ── Price analysis helpers ──
  const analyzePrices = (cpId: string) => {
    const prices: { fId: string; val: number }[] = [];
    fornecedores.forEach((f) => { const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, ""); if (rawVal) { const num = parseFloat(rawVal); if (!isNaN(num) && num > 0) prices.push({ fId: f.id, val: num }); } });
    if (!prices.length) return { min: null, second: null, minVal: null, tiedCount: 0, allVals: [] };
    const minVal = Math.min(...prices.map((p) => p.val));
    const tied = prices.filter((p) => p.val === minVal);
    prices.sort((a, b) => a.val - b.val);
    return { min: tied[0].fId, second: prices.length > 1 ? prices.find((p) => p.val !== minVal)?.fId || null : null, minVal, tiedCount: tied.length, allVals: prices.map((p) => p.val) };
  };

  // Historical-based anomaly detection
  const getHistAlert = (produtoId: string, val: number): "high" | "low" | null => {
    const hist = historicalAvgMap[produtoId];
    if (!hist) return null;
    const diff = (val - hist.avg) / hist.avg;
    if (diff > HIST_HIGH_THRESHOLD) return "high";
    if (diff < -HIST_LOW_THRESHOLD) return "low";
    return null;
  };

  // Intra-quote anomaly: price is >80% above the median of other suppliers for same item
  const getIntraAnomaly = (cpId: string, val: number): "high" | null => {
    const allPrices: number[] = [];
    fornecedores.forEach((f) => {
      const raw = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (raw) { const n = parseFloat(raw); if (!isNaN(n) && n > 0) allPrices.push(n); }
    });
    if (allPrices.length < 3) return null;
    const sorted = [...allPrices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) return null;
    if ((val - median) / median > 0.80) return "high";
    return null;
  };

  const hasAnomaly = (cpId: string) => {
    const cp = cotacaoProdutos.find(c => c.id === cpId);
    if (!cp) return false;
    return fornecedores.some((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (!rawVal) return false;
      const num = parseFloat(rawVal);
      if (isNaN(num) || num <= 0) return false;
      return getHistAlert(cp.produto_id, num) !== null || getIntraAnomaly(cpId, num) !== null;
    });
  };

  // Check if a product has no price from any supplier
  const hasNoPrice = (cpId: string) => {
    return !fornecedores.some((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      return rawVal && parseFloat(rawVal) > 0;
    });
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    cotacaoProdutos.forEach((cp) => { const info = analyzePrices(cp.id); if (info.min && info.minVal !== null) total += info.minVal * (cp.quantidade || 1) * (cp.fator_embalagem || 1); });
    return total;
  }, [localPrices, cotacaoProdutos, fornecedores]);

  const filteredItems = useMemo(() => {
    let items = [...cotacaoProdutos];
    if (search) items = items.filter((cp) => getCotacaoNome(cp as any).toLowerCase().includes(search.toLowerCase()));
    if (filterAnomalies) items = items.filter((cp) => hasAnomaly(cp.id));
    if (filterSemPreco) items = items.filter((cp) => hasNoPrice(cp.id));
    items.sort((a, b) => getCotacaoNome(a as any).localeCompare(getCotacaoNome(b as any), "pt-BR"));
    return items;
  }, [cotacaoProdutos, search, filterAnomalies, filterSemPreco, localPrices, fornecedores]);

  // ── Supplier progress ──
  const supplierProgress = useMemo(() => {
    const total = fornecedores.length;
    const responded = fornecedores.filter((f) =>
      precos.some((p) => p.fornecedor_id === f.id && p.preco !== null && p.preco > 0)
    ).length;
    return { total, responded, percent: total > 0 ? Math.round((responded / total) * 100) : 0 };
  }, [fornecedores, precos]);

  const supplierHasResponded = (fId: string) =>
    precos.some((p) => p.fornecedor_id === fId && p.preco !== null && p.preco > 0);

  const supplierStatus = (fId: string): FornecedorVisualStatus => {
    if (supplierHasResponded(fId)) return "respondeu";
    if (visualizadoMap.get(fId)) return "visualizou";
    return "nao_visualizou";
  };

  const allRespondedAndCanClose =
    !!cotacaoAtiva && supplierProgress.total > 0 && supplierProgress.responded === supplierProgress.total;

  const pendingFornecedores = useMemo(
    () => fornecedores.filter((f) => !supplierHasResponded(f.id)),
    [fornecedores, precos]
  );
  const someRespondedAndCanSkip =
    !!cotacaoAtiva &&
    supplierProgress.total > 0 &&
    supplierProgress.responded > 0 &&
    supplierProgress.responded < supplierProgress.total;

  // ── Handlers ──
  const handlePriceChange = (cpId: string, fornecedorId: string, value: string) => { setLocalPrices((prev) => ({ ...prev, [cpId]: { ...prev[cpId], [fornecedorId]: value } })); };
  const handlePriceBlur = (cpId: string, fornecedorId: string) => { const rawVal = localPrices[cpId]?.[fornecedorId]?.replace(",", ".").replace(/[^0-9.]/g, ""); savePriceMutation.mutate({ cpId, fornecedorId, preco: rawVal ? parseFloat(rawVal) : null }); };

  const saveAll = async () => {
    const promises: Promise<any>[] = [];
    Object.entries(localPrices).forEach(([cpId, fPrices]) => { Object.entries(fPrices).forEach(([fId, val]) => { const numVal = val ? parseFloat(val.replace(",", ".").replace(/[^0-9.]/g, "")) : null; const currentDb = priceMap[cpId]?.[fId] ?? null; if (numVal !== currentDb) promises.push(savePriceMutation.mutateAsync({ cpId, fornecedorId: fId, preco: isNaN(numVal!) ? null : numVal })); }); });
    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ["precos"] });
    toast.success("Preços salvos!");
  };

  const handleFieldBlur = (cpId: string, field: string, value: string, original: string) => {
    if (value.trim() !== original.trim()) {
      if (field === "quantidade") updateCpMutation.mutate({ cpId, field, value: parseFloat(value) || 1 });
      else if (field === "fator") updateCpMutation.mutate({ cpId, field, value: Math.max(1, parseInt(value) || 1) });
      else updateCpMutation.mutate({ cpId, field, value: value.trim() });
    }
  };

  const toggleSupplier = (id: string) => { setSelectedSuppliers((prev) => ({ ...prev, [id]: !prev[id] })); };
  const selectAllSuppliers = (val: boolean) => { const updated: Record<string, boolean> = {}; allFornecedores.forEach((f) => { updated[f.id] = val; }); setSelectedSuppliers(updated); };

  const saveSupplierSelection = async () => {
    if (!cotacaoAtiva?.id) return;
    const selectedIds = new Set(
      Object.entries(selectedSuppliers).filter(([, v]) => v).map(([id]) => id),
    );
    const existing = cotacaoFornecedores as Array<{ fornecedor_id: string; status_envio?: string | null }>;
    const existingIds = new Set(existing.map((cf) => cf.fornecedor_id));

    // Fornecedores que perderam a seleção
    const removidos = existing.filter((cf) => !selectedIds.has(cf.fornecedor_id));
    // Só remove quem ainda está pendente — preserva histórico/status de quem já recebeu pedido
    const removiveis = removidos.filter((cf) => !cf.status_envio || cf.status_envio === "pendente");
    const protegidos = removidos.filter((cf) => cf.status_envio && cf.status_envio !== "pendente");

    if (removiveis.length) {
      await supabase
        .from("cotacao_fornecedores")
        .delete()
        .eq("cotacao_id", cotacaoAtiva.id)
        .in("fornecedor_id", removiveis.map((r) => r.fornecedor_id));
    }

    // Inserir apenas os novos — upsert com ignoreDuplicates preserva status_envio/enviado_em de quem já existe
    const novos = Array.from(selectedIds).filter((id) => !existingIds.has(id));
    if (novos.length) {
      await supabase
        .from("cotacao_fornecedores")
        .upsert(
          novos.map((fid) => ({ cotacao_id: cotacaoAtiva.id, fornecedor_id: fid })),
          { onConflict: "cotacao_id,fornecedor_id", ignoreDuplicates: true },
        );
    }

    queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
    setSupplierModalOpen(false);

    if (protegidos.length) {
      toast.warning(
        `${protegidos.length} fornecedor(es) já contatado(s) foram mantidos para preservar o histórico de envio.`,
      );
    } else {
      toast.success("Seleção de fornecedores salva!");
    }
  };

  const buildSuspiciousReport = () => {
    const rows: any[] = [];
    cotacaoProdutos.forEach((cp) => {
      const hist = historicalAvgMap[cp.produto_id];
      if (!hist) return;
      fornecedores.forEach((f) => {
        const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, ""); if (!rawVal) return;
        const num = parseFloat(rawVal); if (isNaN(num) || num <= 0) return;
        const alert = getHistAlert(cp.produto_id, num);
        if (!alert) return;
        const diff = ((num - hist.avg) / hist.avg * 100).toFixed(1);
        rows.push({ Produto: cp.produto?.nome || "", Embalagem: cp.produto?.embalagem || "un", Fornecedor: f.nome, Preço: num, "Média Histórica": formatNumber(hist.avg), "Desvio Histórico": `${Number(diff) > 0 ? "+" : ""}${diff}%`, Tipo: alert === "high" ? "🔴 Acima do histórico" : "⚠️ Abaixo do histórico", "Cotações base": hist.count });
      });
    });
    return rows;
  };

  const exportSuspiciousReport = () => {
    const rows = buildSuspiciousReport();
    if (!rows.length) { toast.info("Nenhum preço suspeito detectado nesta cotação."); return; }
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos");
    XLSX.writeFile(wb, `precos-suspeitos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Relatório exportado com ${rows.length} preço(s) suspeito(s).`);
  };

  const handleNovaCotacao = async (prazoIso: string | null) => {
    if (!novaCotacaoOpt || !cotacaoAtiva) return;
    try {
      const suspiciousRows = buildSuspiciousReport();
      if (suspiciousRows.length > 0) { const ws = XLSX.utils.json_to_sheet(suspiciousRows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos"); XLSX.writeFile(wb, `precos-suspeitos-${cotacaoAtiva.nome.replace(/\s+/g, "-")}.xlsx`); toast.info(`${suspiciousRows.length} preço(s) suspeito(s) exportado(s) automaticamente.`); }
      { const _now = new Date(); await supabase.from("cotacoes").update({ status: "finalizada", finalizada_at: _now.toISOString(), nome: `Cotação ${_now.toLocaleDateString("pt-BR")}` }).eq("id", cotacaoAtiva.id); }
      const { data: newCot, error } = await supabase.from("cotacoes").insert({ nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`, status: "ativa", loja_id: lojaAtiva?.id || null, created_by: user?.id, prazo_resposta: prazoIso } as any).select().single();
      if (error) throw error;
      if ((novaCotacaoOpt === "manter" || novaCotacaoOpt === "manter_precos") && newCot) {
        const { data: newCps } = await supabase.from("cotacao_produtos").insert(cotacaoProdutos.map((cp: any) => ({ cotacao_id: newCot.id, produto_id: cp.produto_id, catalogo_mestre_id: cp.catalogo_mestre_id ?? null, nome: getCotacaoNome(cp), ean: cp.ean ?? null, quantidade: cp.quantidade })) as any).select();
        if (novaCotacaoOpt === "manter_precos" && newCps?.length) {
          const priceInserts: { cotacao_produto_id: string; fornecedor_id: string; preco: number }[] = [];
          for (const newCp of newCps) { const oldCp = cotacaoProdutos.find((cp) => cp.produto_id === newCp.produto_id); if (!oldCp) continue; const oldPrices = precos.filter((p) => p.cotacao_produto_id === oldCp.id && p.preco !== null); for (const op of oldPrices) priceInserts.push({ cotacao_produto_id: newCp.id, fornecedor_id: op.fornecedor_id, preco: op.preco! }); }
          if (priceInserts.length) await supabase.from("precos").insert(priceInserts);
          toast.success("Nova cotação com preços importados!");
        } else { toast.success("Nova cotação iniciada — preços limpos!"); }
      } else if (novaCotacaoOpt === "zerar" && newCot) {
        // Auto-transfer items that had no price from any supplier
        const semPrecoItems = cotacaoProdutos.filter((cp) => hasNoPrice(cp.id));
        if (semPrecoItems.length > 0) {
          await supabase.from("cotacao_produtos").insert(semPrecoItems.map((cp: any) => ({ cotacao_id: newCot.id, produto_id: cp.produto_id, catalogo_mestre_id: cp.catalogo_mestre_id ?? null, nome: getCotacaoNome(cp), ean: cp.ean ?? null, quantidade: cp.quantidade })) as any);
          toast.success(`Cotação zerada — ${semPrecoItems.length} item(ns) sem preço transferido(s) automaticamente!`);
        } else {
          toast.success("Cotação reiniciada — lista zerada!");
        }
      } else { toast.success("Cotação reiniciada — lista zerada!"); }
      queryClient.invalidateQueries(); setNovaCotacaoOpen(false); setNovaCotacaoOpt(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const runQtySuggestion = async () => {
    if (!cotacaoAtiva?.id) return;
    setQtySuggestLoading(true); setQtySuggestOpen(true); setQtySuggestions([]); setQtySuggestLojaNome(""); setQtySuggestMultiStore(false);
    try {
      const resp = await supabase.functions.invoke("ai-automacao", { body: { type: "suggest-quantities", cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id || null } });
      if (resp.error) throw new Error(resp.error.message);
      setQtySuggestions(resp.data?.suggestions || []);
      setQtySuggestLojaNome(resp.data?.loja_nome || "");
      setQtySuggestMultiStore(resp.data?.multi_store || false);
    } catch (e: any) { toast.error(e.message || "Erro ao sugerir quantidades"); }
    setQtySuggestLoading(false);
  };

  const runFornSuggestion = async () => {
    if (!cotacaoAtiva?.id) return;
    setFornSuggestLoading(true); setFornSuggestOpen(true); setFornSuggestText(""); setFornSuggestHasHistory(false); setFornSuggestRecommendedIds([]);
    try {
      const resp = await supabase.functions.invoke("ai-automacao", { body: { type: "suggest-fornecedores", cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id || null } });
      if (resp.error) throw new Error(resp.error.message);
      setFornSuggestText(resp.data?.text || "");
      setFornSuggestHasHistory(resp.data?.has_history ?? false);
      setFornSuggestRecommendedIds(resp.data?.recommended_supplier_ids || []);
    } catch (e: any) { toast.error(e.message || "Erro ao sugerir fornecedores"); }
    setFornSuggestLoading(false);
  };

  const applyFornSuggestions = () => {
    if (!fornSuggestRecommendedIds.length) return;
    const updated: Record<string, boolean> = {};
    allFornecedores.forEach((f) => { updated[f.id] = fornSuggestRecommendedIds.includes(f.id); });
    setSelectedSuppliers(updated);
    setFornSuggestOpen(false);
    toast.success(`${fornSuggestRecommendedIds.length} fornecedores recomendados selecionados!`);
  };

  const applyQtySuggestions = async () => {
    let applied = 0;
    for (const s of qtySuggestions) { if (s.cotacao_produto_id && s.quantidade_sugerida) { const { error } = await supabase.from("cotacao_produtos").update({ quantidade: s.quantidade_sugerida }).eq("id", s.cotacao_produto_id); if (!error) applied++; } }
    queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] }); setQtySuggestOpen(false);
    if (applied > 0) toast.success(`${applied} quantidades atualizadas com sugestões da IA!`); else toast.error("Nenhuma quantidade pôde ser aplicada.");
  };

  const runAiAnalysis = async () => {
    if (!checkPlan("pro", "Análise de preços com IA")) return;
    if (!cotacaoAtiva?.id) return;
    setAiAnalysisOpen(true); setAiAnalysisText(""); setAiAnalysisLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-precos`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ cotacao_id: cotacaoAtiva.id }) });
      if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Erro desconhecido" })); toast.error(err.error || "Erro na análise de IA"); setAiAnalysisLoading(false); return; }
      const reader = resp.body?.getReader(); if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder(); let buffer = "", fullText = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); let idx: number; while ((idx = buffer.indexOf("\n")) !== -1) { let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1); if (line.endsWith("\r")) line = line.slice(0, -1); if (!line.startsWith("data: ")) continue; const jsonStr = line.slice(6).trim(); if (jsonStr === "[DONE]") break; try { const parsed = JSON.parse(jsonStr); const content = parsed.choices?.[0]?.delta?.content; if (content) { fullText += content; setAiAnalysisText(fullText); } } catch {} } }
      if (buffer.trim()) { for (let raw of buffer.split("\n")) { if (!raw?.startsWith("data: ")) continue; const jsonStr = raw.slice(6).trim(); if (jsonStr === "[DONE]") continue; try { const parsed = JSON.parse(jsonStr); const content = parsed.choices?.[0]?.delta?.content; if (content) { fullText += content; setAiAnalysisText(fullText); } } catch {} } }
    } catch (e: any) { toast.error(e.message || "Erro na análise"); } finally { setAiAnalysisLoading(false); }
  };

  const copySupplierLink = (f: Fornecedor) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/fornecedor/${f.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleCancelCotacao = async () => {
    if (!cotacaoAtiva?.id) return;
    setCancelLoading(true);
    try {
      // Snapshot products before deleting if user wants to keep them
      const keepItems = cancelOpt === "manter";
      const savedProducts = keepItems
        ? cotacaoProdutos.map((cp) => ({
            produto_id: cp.produto_id,
            catalogo_mestre_id: cp.catalogo_mestre_id,
            nome: cp.nome,
            ean: cp.ean,
            quantidade: cp.quantidade,
            tipo_embalagem: cp.tipo_embalagem,
            fator_embalagem: cp.fator_embalagem,
          }))
        : [];

      // Garantir que não existam outras cotações ativas para a mesma loja
      await supabase
        .from("cotacoes")
        .update({ status: "finalizada" as any })
        .eq("loja_id", lojaAtiva?.id || null)
        .eq("status", "ativa")
        .neq("id", cotacaoAtiva.id);

      // Delete prices for this quote's products
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (cpIds.length) {
        await supabase.from("precos").delete().in("cotacao_produto_id", cpIds);
      }
      // Delete cotacao_produtos
      await supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotacaoAtiva.id);
      // Delete cotacao_fornecedores
      await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotacaoAtiva.id);
      // Delete the cotacao itself
      await supabase.from("cotacoes").delete().eq("id", cotacaoAtiva.id);

      // If keeping items, create a new cotação with the same products
      if (keepItems && savedProducts.length > 0) {
        const nome = `Cotação ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        const { data: newCot, error: newCotError } = await supabase
          .from("cotacoes")
          .insert({ nome, status: "ativa", loja_id: lojaAtiva?.id || null, created_by: user?.id } as any)
          .select()
          .single();
        if (newCotError) throw newCotError;
        if (newCot) {
          await supabase.from("cotacao_produtos").insert(
            savedProducts.map((p: any) => ({
              cotacao_id: newCot.id,
              produto_id: p.produto_id,
              catalogo_mestre_id: p.catalogo_mestre_id ?? null,
              nome: p.nome,
              ean: p.ean ?? null,
              quantidade: p.quantidade,
              tipo_embalagem: p.tipo_embalagem,
              fator_embalagem: p.fator_embalagem,
            })) as any
          );
        }
        toast.success(`Cotação excluída. Nova cotação criada com ${savedProducts.length} produto(s)!`);
      } else {
        // Limpeza de segurança — encerrar qualquer cotação ativa residual
        await supabase
          .from("cotacoes")
          .update({ status: "finalizada" as any })
          .eq("loja_id", lojaAtiva?.id || null)
          .eq("status", "ativa");
        toast.success("Cotação excluída com sucesso");
      }

      // Reset local state
      setLocalPrices({});
      setSelectedSuppliers({});
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir cotação");
    } finally {
      setCancelLoading(false);
      setCancelCotacaoOpen(false);
      setCancelOpt("manter");
    }
  };

  const handleSkipPending = async () => {
    if (!cotacaoAtiva?.id || pendingFornecedores.length === 0) return;
    setSkipPendingLoading(true);
    try {
      const pendingIds = pendingFornecedores.map((f) => f.id);
      // Remove preços vazios desses fornecedores nesta cotação
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (cpIds.length) {
        await supabase
          .from("precos")
          .delete()
          .in("cotacao_produto_id", cpIds)
          .in("fornecedor_id", pendingIds);
      }
      // Remove os fornecedores pendentes da cotação
      await supabase
        .from("cotacao_fornecedores")
        .delete()
        .eq("cotacao_id", cotacaoAtiva.id)
        .in("fornecedor_id", pendingIds);

      await queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
      await queryClient.invalidateQueries({ queryKey: ["precos"] });
      toast.success(
        `${pendingIds.length} fornecedor(es) removido(s) da cotação. Você já pode fechar.`
      );
      setSkipPendingOpen(false);
      // Abre o modal de fechar/nova cotação
      setNovaCotacaoOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover fornecedores pendentes");
    } finally {
      setSkipPendingLoading(false);
    }
  };

  // ── Empty state → redirect to Dashboard guided flow ──
  useEffect(() => {
    if (cotacaoFetched && !cotacaoAtiva) {
      navigate("/dashboard", { replace: true });
    }
  }, [cotacaoFetched, cotacaoAtiva, navigate]);

  if (!cotacaoAtiva) {
    return null;
  }

  return (
    <TooltipProvider>
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-3 pt-2 empty:hidden">
        <BackToLojaButton />
      </div>
      {/* Back to dashboard banner */}
      {isFromDashboard && (
        <div className="px-3 py-2 bg-primary/5 border-b flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Button>
          <div className="flex-1" />
          {isReviewMode && (
            <Button size="sm" variant="outline" onClick={runAiAnalysis} disabled={aiAnalysisLoading} className="gap-1 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/5">
              <Sparkles className="h-4 w-4" /> Análise IA
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-1"><MoreHorizontal className="h-4 w-4" /><span className="text-xs">Mais</span></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setSupplierModalOpen(true)}><Users className="h-4 w-4 mr-2" /> Fornecedores ({fornecedores.length})</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterAnomalies(!filterAnomalies)}><Filter className="h-4 w-4 mr-2" /> {filterAnomalies ? "✓ Filtro anomalias" : "Filtrar anomalias"}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportSuspiciousReport}><FileWarning className="h-4 w-4 mr-2" /> Relatório suspeitos</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setErpImportOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar ERP</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={runAiAnalysis} disabled={aiAnalysisLoading}><Sparkles className="h-4 w-4 mr-2" /> Análise IA</DropdownMenuItem>
              <DropdownMenuItem onClick={runQtySuggestion} disabled={qtySuggestLoading}><Wand2 className="h-4 w-4 mr-2" /> Sugerir quantidades</DropdownMenuItem>
              <DropdownMenuItem onClick={runFornSuggestion} disabled={fornSuggestLoading}><Target className="h-4 w-4 mr-2" /> Fornecedores recomendados</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => queryClient.invalidateQueries()}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar dados</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNovaCotacaoOpen(true)}><RotateCcw className="h-4 w-4 mr-2" /> Nova cotação</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCancelCotacaoOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir cotação</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {/* Toolbar — search + save only */}
      <div className="p-3 border-b bg-card flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button size="sm" onClick={saveAll} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        {!isFromDashboard && isReviewMode && (
          <Button size="sm" variant="outline" onClick={runAiAnalysis} disabled={aiAnalysisLoading} className="gap-1 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/5">
            <Sparkles className="h-4 w-4" /> Análise IA
          </Button>
        )}
        {!isFromDashboard && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-1"><MoreHorizontal className="h-4 w-4" /><span className="text-xs">Mais</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setSupplierModalOpen(true)}><Users className="h-4 w-4 mr-2" /> Fornecedores ({fornecedores.length})</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterAnomalies(!filterAnomalies)}><Filter className="h-4 w-4 mr-2" /> {filterAnomalies ? "✓ Filtro anomalias" : "Filtrar anomalias"}</DropdownMenuItem>
            <DropdownMenuItem onClick={exportSuspiciousReport}><FileWarning className="h-4 w-4 mr-2" /> Relatório suspeitos</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setErpImportOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" /> Importar ERP</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={runAiAnalysis} disabled={aiAnalysisLoading}><Sparkles className="h-4 w-4 mr-2" /> Análise IA</DropdownMenuItem>
            <DropdownMenuItem onClick={runQtySuggestion} disabled={qtySuggestLoading}><Wand2 className="h-4 w-4 mr-2" /> Sugerir quantidades</DropdownMenuItem>
            <DropdownMenuItem onClick={runFornSuggestion} disabled={fornSuggestLoading}><Target className="h-4 w-4 mr-2" /> Fornecedores recomendados</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => queryClient.invalidateQueries()}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar dados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNovaCotacaoOpen(true)}><RotateCcw className="h-4 w-4 mr-2" /> Nova cotação</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCancelCotacaoOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir cotação</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b bg-card/50 flex items-center gap-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {supplierProgress.responded} de {supplierProgress.total} fornecedores responderam
        </span>
        <Progress value={supplierProgress.percent} className="h-2 flex-1 bg-muted [&>div]:bg-green-500" />
        <span className="text-xs font-bold text-muted-foreground">{supplierProgress.percent}%</span>
      </div>

      {/* Banner: todos os fornecedores responderam */}
      {allRespondedAndCanClose && !isReviewMode && (
        <div className="px-4 py-2 border-b bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 flex items-center gap-2 text-xs sm:text-sm text-green-800 dark:text-green-200">
          <span className="text-base">✅</span>
          <span className="flex-1">
            Todos os fornecedores responderam — você pode fechar a cotação antecipadamente.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 border-green-500/40 text-green-700 dark:text-green-300 hover:bg-green-500/10"
            onClick={() => setNovaCotacaoOpen(true)}
          >
            Fechar agora
          </Button>
        </div>
      )}

      {/* Banner: alguns pendentes — seguir sem eles */}
      {someRespondedAndCanSkip && !isReviewMode && (
        <div className="px-4 py-2 border-b bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 flex items-center gap-2 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <span className="text-base">⏳</span>
          <span className="flex-1">
            {pendingFornecedores.length === 1
              ? <>Falta apenas <strong>{pendingFornecedores[0].nome}</strong> responder. Não quer esperar?</>
              : <><strong>{pendingFornecedores.length}</strong> fornecedor(es) ainda não responderam. Não quer esperar?</>}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10"
            onClick={() => setSkipPendingOpen(true)}
          >
            Seguir sem {pendingFornecedores.length === 1 ? "ele" : "eles"}
          </Button>
        </div>
      )}

      {/* Supplier chips — hidden in review mode */}
      {!isReviewMode && fornecedores.length > 0 && (
        <div className="px-4 py-2 border-b bg-card/50 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {fornecedores.map((f) => {
            const status = supplierStatus(f.id);
            const responded = status === "respondeu";
            return (
              <Popover key={f.id}>
                <PopoverTrigger asChild>
                  <button className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    responded
                      ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                      : status === "visualizou"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                      : "bg-muted/50 border-border text-muted-foreground"
                  }`}>
                    <StatusFornecedorBadge status={status} compact />
                    <span className="truncate max-w-[140px]">{f.nome}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1.5" align="start">
                  <button
                    onClick={() => copySupplierLink(f)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    Copiar link WhatsApp
                  </button>
                  <button
                    onClick={() => setSupplierModalOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    Gerenciar fornecedores
                  </button>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      )}

      {/* Quick filter + Legend toggle */}
      <div className="px-4 py-1.5 border-b bg-card/50 flex items-center gap-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setFilterSemPreco(false)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!filterSemPreco ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Todos
          </button>
          {(() => {
            const semPrecoCount = cotacaoProdutos.filter((cp) => hasNoPrice(cp.id)).length;
            return (
              <button
                onClick={() => setFilterSemPreco(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterSemPreco
                    ? "bg-background shadow-sm text-foreground"
                    : semPrecoCount > 0
                      ? "text-destructive font-bold"
                      : "text-muted-foreground"
                }`}
              >
                Sem preço{semPrecoCount > 0 && ` (${semPrecoCount})`}
              </button>
            );
          })()}
        </div>
        <div className="flex-1" />
        <button
          onClick={toggleLegend}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Legenda
        </button>
      </div>

      <TabelaCotacao
        filteredItems={filteredItems}
        fornecedores={fornecedores}
        precos={precos}
        localPrices={localPrices}
        filterAnomalies={filterAnomalies}
        cotacaoProdutosCount={cotacaoProdutos.length}
        grandTotal={grandTotal}
        legendVisible={legendVisible}
        onLegendClose={toggleLegend}
        analyzePrices={analyzePrices}
        getHistAlert={getHistAlert}
        getIntraAnomaly={getIntraAnomaly}
        historicalAvgMap={historicalAvgMap}
        onPriceChange={handlePriceChange}
        onPriceBlur={handlePriceBlur}
        onFieldBlur={handleFieldBlur}
        onDeleteItem={handleDeleteItem}
        isReviewMode={isReviewMode}
      />

      {/* Review mode fixed footer */}
      {isReviewMode && (
        <ReviewFooter itemCount={cotacaoProdutos.length} supplierCount={fornecedores.length} />
      )}

      <ModalFornecedores open={supplierModalOpen} onOpenChange={setSupplierModalOpen} fornecedores={allFornecedores} selectedSuppliers={selectedSuppliers} onToggle={toggleSupplier} onSelectAll={selectAllSuppliers} onSave={saveSupplierSelection} />
      <ModalNovaCotacao open={novaCotacaoOpen} onOpenChange={setNovaCotacaoOpen} novaCotacaoOpt={novaCotacaoOpt} setNovaCotacaoOpt={setNovaCotacaoOpt} onConfirm={handleNovaCotacao} lojaId={lojaAtiva?.id} />
      <ModalAiAnalise open={aiAnalysisOpen} onOpenChange={setAiAnalysisOpen} text={aiAnalysisText} loading={aiAnalysisLoading} onReanalisar={runAiAnalysis} />
      <ModalQtySugestao open={qtySuggestOpen} onOpenChange={setQtySuggestOpen} suggestions={qtySuggestions} loading={qtySuggestLoading} onApply={applyQtySuggestions} lojaNome={qtySuggestLojaNome} multiStore={qtySuggestMultiStore} />
      <ImportErpModal open={erpImportOpen} onOpenChange={setErpImportOpen} cotacaoId={cotacaoAtiva.id} />
      <ModalFornecedorSugestao open={fornSuggestOpen} onOpenChange={setFornSuggestOpen} text={fornSuggestText} loading={fornSuggestLoading} hasHistory={fornSuggestHasHistory} recommendedIds={fornSuggestRecommendedIds} onApply={applyFornSuggestions} />

      <AlertDialog open={cancelCotacaoOpen} onOpenChange={(v) => { setCancelCotacaoOpen(v); if (!v) setCancelOpt("manter"); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação em andamento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Essa ação não poderá ser desfeita. Escolha o que fazer com os produtos:</p>
                <label
                  className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${cancelOpt === "manter" ? "border-primary bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
                  onClick={() => setCancelOpt("manter")}
                >
                  <input type="radio" name="cancel-opt" checked={cancelOpt === "manter"} readOnly className="mt-1 accent-[hsl(var(--primary))]" />
                  <div>
                    <div className="text-sm font-bold text-foreground">Manter lista de produtos</div>
                    <div className="text-xs text-muted-foreground">Exclui a cotação e os preços, mas cria uma nova com os mesmos produtos.</div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${cancelOpt === "excluir_tudo" ? "border-destructive bg-red-50 dark:bg-red-950/20" : "border-border hover:border-muted-foreground/30"}`}
                  onClick={() => setCancelOpt("excluir_tudo")}
                >
                  <input type="radio" name="cancel-opt" checked={cancelOpt === "excluir_tudo"} readOnly className="mt-1 accent-red-600" />
                  <div>
                    <div className="text-sm font-bold text-foreground">Excluir tudo</div>
                    <div className="text-xs text-muted-foreground">Remove todos os produtos, preços e fornecedores permanentemente.</div>
                  </div>
                </label>
                {importedItemsCount > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      <strong>{importedItemsCount} ite{importedItemsCount === 1 ? 'm foi importado' : 'ns foram importados'}</strong> desta lista. Se continuar, eles ficarão no histórico por 30 dias e poderão ser restaurados.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelCotacao}
              disabled={cancelLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelLoading ? "Excluindo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={skipPendingOpen} onOpenChange={setSkipPendingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seguir sem os fornecedores pendentes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Os fornecedores abaixo serão <strong>removidos desta cotação</strong> e
                  você poderá fechá-la imediatamente. Eles continuarão disponíveis para
                  cotações futuras.
                </p>
                <ul className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border bg-muted/30 p-2">
                  {pendingFornecedores.map((f) => (
                    <li key={f.id} className="text-sm text-foreground flex items-center gap-2">
                      <span className="text-amber-600">•</span> {f.nome}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={skipPendingLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSkipPending(); }}
              disabled={skipPendingLoading}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {skipPendingLoading ? "Removendo..." : "Remover e fechar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </div>
    </TooltipProvider>
  );
};

export default CotacaoPage;
