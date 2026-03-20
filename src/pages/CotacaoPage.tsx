import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Save, RefreshCw, FileWarning, Filter, Users, Sparkles, Loader2, Wand2, MessageSquare, MoreHorizontal, FileSpreadsheet, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatNumber } from "@/lib/format";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import ImportErpModal from "@/components/ImportErpModal";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";

type Fornecedor = Tables<"fornecedores">;
type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };

interface CotacaoProduto {
  id: string;
  produto_id: string;
  cotacao_id: string;
  quantidade: number | null;
  produto?: Produto;
}

interface Preco {
  id: string;
  cotacao_produto_id: string;
  fornecedor_id: string;
  preco: number | null;
}

const HIGH_THRESHOLD = 0.25;
const LOW_THRESHOLD = 0.15;
const MIN_SUPPLIERS_FOR_ANALYSIS = 3;

const CotacaoPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const [search, setSearch] = useState("");
  const [localPrices, setLocalPrices] = useState<Record<string, Record<string, string>>>({});
  const [novaCotacaoOpen, setNovaCotacaoOpen] = useState(false);
  const [novaCotacaoOpt, setNovaCotacaoOpt] = useState<"manter" | "manter_precos" | "zerar" | null>(null);
  const [legendVisible, setLegendVisible] = useState(true);
  const [filterAnomalies, setFilterAnomalies] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});

  const [editingField, setEditingField] = useState<Record<string, { quantidade?: string; embalagem?: string; nome?: string }>>({});

  // AI Analysis state
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  // Quantity suggestion state
  const [qtySuggestLoading, setQtySuggestLoading] = useState(false);
  const [qtySuggestions, setQtySuggestions] = useState<{ cotacao_produto_id: string; nome: string; quantidade_sugerida: number; justificativa: string }[]>([]);
  const [qtySuggestOpen, setQtySuggestOpen] = useState(false);

  // WhatsApp AI state
  const [whatsappAiLoading, setWhatsappAiLoading] = useState<string | null>(null);

  // ERP Import state
  const [erpImportOpen, setErpImportOpen] = useState(false);

  const { data: cotacaoAtiva } = useQuery({
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

  // Fetch fornecedor_lojas to filter by active store
  const { data: fornecedorLojas = [] } = useQuery({
    queryKey: ["fornecedor-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedor_lojas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: allFornecedoresRaw = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  // Filter suppliers by active store: show only those linked to this store (or unlinked ones)
  const allFornecedores = useMemo(() => {
    if (!lojaAtiva?.id) return allFornecedoresRaw;
    const linkedToStore = new Set(
      fornecedorLojas.filter((fl: any) => fl.loja_id === lojaAtiva.id).map((fl: any) => fl.fornecedor_id)
    );
    // Show suppliers linked to this store, or suppliers not linked to any store
    const allLinked = new Set(fornecedorLojas.map((fl: any) => fl.fornecedor_id));
    return allFornecedoresRaw.filter((f) => linkedToStore.has(f.id) || !allLinked.has(f.id));
  }, [allFornecedoresRaw, fornecedorLojas, lojaAtiva?.id]);

  // Load persisted supplier selection from DB
  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_fornecedores")
        .select("fornecedor_id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize selected suppliers from DB or default all
  useEffect(() => {
    if (!allFornecedores.length || !cotacaoAtiva?.id) return;
    if (cotacaoFornecedores.length > 0) {
      const sel: Record<string, boolean> = {};
      allFornecedores.forEach((f) => { sel[f.id] = false; });
      cotacaoFornecedores.forEach((cf: any) => { sel[cf.fornecedor_id] = true; });
      // Only update if changed to avoid infinite loop
      setSelectedSuppliers((prev) => {
        const prevKeys = Object.keys(prev).sort().join(",");
        const newKeys = Object.keys(sel).sort().join(",");
        const prevVals = Object.values(prev).join(",");
        const newVals = Object.values(sel).join(",");
        if (prevKeys === newKeys && prevVals === newVals) return prev;
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

  // Only selected suppliers participate
  const fornecedores = useMemo(() =>
    allFornecedores.filter((f) => selectedSuppliers[f.id] !== false),
    [allFornecedores, selectedSuppliers]
  );

  const { data: cotacaoProdutos = [] } = useQuery({
    queryKey: ["cotacao-produtos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(*, categorias(nome))")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return (data || []).map((cp: any) => ({
        id: cp.id,
        produto_id: cp.produto_id,
        cotacao_id: cp.cotacao_id,
        quantidade: cp.quantidade,
        produto: cp.produtos,
      })) as CotacaoProduto[];
    },
  });

  const { data: precos = [] } = useQuery({
    queryKey: ["precos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (!cpIds.length) return [];
      const { data, error } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      if (error) throw error;
      return data as Preco[];
    },
  });

  // Fetch historical prices from finalized cotações
  const { data: historicalPrices = [] } = useQuery({
    queryKey: ["historical-prices", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id && cotacaoProdutos.length > 0,
    queryFn: async () => {
      const produtoIds = cotacaoProdutos.map((cp) => cp.produto_id);
      if (!produtoIds.length) return [];
      // Get last finalized cotação
      const { data: lastCot } = await supabase
        .from("cotacoes")
        .select("id")
        .eq("status", "finalizada")
        .order("finalizada_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastCot) return [];
      // Get cotacao_produtos from that cotação for same products
      const { data: oldCps } = await supabase
        .from("cotacao_produtos")
        .select("id, produto_id")
        .eq("cotacao_id", lastCot.id)
        .in("produto_id", produtoIds);
      if (!oldCps?.length) return [];
      const oldCpIds = oldCps.map((cp: any) => cp.id);
      const { data: oldPrecos } = await supabase
        .from("precos")
        .select("*")
        .in("cotacao_produto_id", oldCpIds);
      // Map: produto_id -> { fornecedor_id -> preco }
      return (oldPrecos || []).map((p: any) => {
        const cp = oldCps.find((c: any) => c.id === p.cotacao_produto_id);
        return { ...p, produto_id: cp?.produto_id };
      });
    },
  });

  const historicalMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    historicalPrices.forEach((p: any) => {
      if (p.produto_id && p.preco !== null && p.preco > 0) {
        if (!map[p.produto_id]) map[p.produto_id] = {};
        map[p.produto_id][p.fornecedor_id] = p.preco;
      }
    });
    return map;
  }, [historicalPrices]);

  const priceMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    precos.forEach((p) => {
      if (!map[p.cotacao_produto_id]) map[p.cotacao_produto_id] = {};
      map[p.cotacao_produto_id][p.fornecedor_id] = p.preco;
    });
    return map;
  }, [precos]);

  // Realtime subscription for price updates from suppliers
  useEffect(() => {
    if (!cotacaoAtiva?.id) return;
    const channel = supabase
      .channel('precos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'precos' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["precos", cotacaoAtiva.id] });
          toast.info("📬 Preços atualizados por um fornecedor!", { duration: 4000 });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cotacaoAtiva?.id]);

  useEffect(() => {
    const lp: Record<string, Record<string, string>> = {};
    cotacaoProdutos.forEach((cp) => {
      lp[cp.id] = {};
      fornecedores.forEach((f) => {
        const val = priceMap[cp.id]?.[f.id];
        lp[cp.id][f.id] = val !== null && val !== undefined ? formatNumber(val) : "";
      });
    });
    setLocalPrices(lp);
  }, [cotacaoProdutos, fornecedores, priceMap]);

  const savePriceMutation = useMutation({
    mutationFn: async ({ cpId, fornecedorId, preco }: { cpId: string; fornecedorId: string; preco: number | null }) => {
      const existing = precos.find((p) => p.cotacao_produto_id === cpId && p.fornecedor_id === fornecedorId);
      if (existing) {
        const { error } = await supabase.from("precos").update({ preco }).eq("id", existing.id);
        if (error) throw error;
      } else if (preco !== null) {
        const { error } = await supabase.from("precos").insert({ cotacao_produto_id: cpId, fornecedor_id: fornecedorId, preco });
        if (error) throw error;
      }
    },
  });

  const updateCpMutation = useMutation({
    mutationFn: async ({ cpId, field, value }: { cpId: string; field: string; value: any }) => {
      if (field === "quantidade") {
        const { error } = await supabase.from("cotacao_produtos").update({ quantidade: value }).eq("id", cpId);
        if (error) throw error;
      } else if (field === "nome" || field === "embalagem") {
        const cp = cotacaoProdutos.find(c => c.id === cpId);
        if (cp?.produto_id) {
          const { error } = await supabase.from("produtos").update({ [field]: value }).eq("id", cp.produto_id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  const handlePriceChange = (cpId: string, fornecedorId: string, value: string) => {
    setLocalPrices((prev) => ({
      ...prev,
      [cpId]: { ...prev[cpId], [fornecedorId]: value },
    }));
  };

  const handlePriceBlur = (cpId: string, fornecedorId: string) => {
    const rawVal = localPrices[cpId]?.[fornecedorId]?.replace(",", ".").replace(/[^0-9.]/g, "");
    const numVal = rawVal ? parseFloat(rawVal) : null;
    savePriceMutation.mutate({ cpId, fornecedorId, preco: numVal });
  };

  const saveAll = async () => {
    const promises: Promise<any>[] = [];
    Object.entries(localPrices).forEach(([cpId, fPrices]) => {
      Object.entries(fPrices).forEach(([fId, val]) => {
        const numVal = val ? parseFloat(val.replace(",", ".").replace(/[^0-9.]/g, "")) : null;
        const currentDb = priceMap[cpId]?.[fId] ?? null;
        if (numVal !== currentDb) {
          promises.push(savePriceMutation.mutateAsync({ cpId, fornecedorId: fId, preco: isNaN(numVal!) ? null : numVal }));
        }
      });
    });
    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ["precos"] });
    toast.success("Preços salvos!");
  };

  const analyzePrices = (cpId: string) => {
    const prices: { fId: string; val: number }[] = [];
    fornecedores.forEach((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (rawVal) {
        const num = parseFloat(rawVal);
        if (!isNaN(num) && num > 0) prices.push({ fId: f.id, val: num });
      }
    });
    if (!prices.length) return { min: null, second: null, minVal: null, tiedCount: 0, allVals: [] };

    const minVal = Math.min(...prices.map((p) => p.val));
    const tied = prices.filter((p) => p.val === minVal);
    const tiedCount = tied.length;
    const allVals = prices.map((p) => p.val);

    prices.sort((a, b) => a.val - b.val);
    return {
      min: tied[0].fId,
      second: prices.length > 1 ? prices.find((p) => p.val !== minVal)?.fId || null : null,
      minVal,
      tiedCount,
      allVals,
    };
  };

  const isHighVariation = (val: number, allVals: number[]) => {
    if (allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return false;
    const sorted = [...allVals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (median <= 0) return false;
    return (val - median) / median > HIGH_THRESHOLD;
  };

  const isLowVariation = (val: number, allVals: number[]) => {
    if (allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return false;
    const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    if (avg <= 0) return false;
    return (avg - val) / avg >= LOW_THRESHOLD;
  };

  // Check if a product row has any anomaly
  const hasAnomaly = (cpId: string) => {
    const info = analyzePrices(cpId);
    if (info.allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return false;
    return fornecedores.some((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (!rawVal) return false;
      const num = parseFloat(rawVal);
      if (isNaN(num) || num <= 0) return false;
      return isHighVariation(num, info.allVals) || isLowVariation(num, info.allVals);
    });
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    cotacaoProdutos.forEach((cp) => {
      const info = analyzePrices(cp.id);
      if (info.min && info.minVal !== null) {
        total += info.minVal * (cp.quantidade || 1);
      }
    });
    return total;
  }, [localPrices, cotacaoProdutos, fornecedores]);

  const filteredItems = useMemo(() => {
    let items = [...cotacaoProdutos];
    if (search) {
      items = items.filter((cp) => cp.produto?.nome.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterAnomalies) {
      items = items.filter((cp) => hasAnomaly(cp.id));
    }
    items.sort((a, b) => (a.produto?.nome || "").localeCompare(b.produto?.nome || "", "pt-BR"));
    return items;
  }, [cotacaoProdutos, search, filterAnomalies, localPrices, fornecedores]);

  // (realtime subscription is already set up above — lines 191-205)

  const buildSuspiciousReport = () => {
    const rows: { Produto: string; Embalagem: string; Fornecedor: string; Preço: number; Média: string; Desvio: string; Tipo: string; "Preço Anterior": string; "Variação Histórica": string }[] = [];
    cotacaoProdutos.forEach((cp) => {
      const info = analyzePrices(cp.id);
      if (info.allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return;
      const avg = info.allVals.reduce((a, b) => a + b, 0) / info.allVals.length;
      fornecedores.forEach((f) => {
        const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
        if (!rawVal) return;
        const num = parseFloat(rawVal);
        if (isNaN(num) || num <= 0) return;
        const hi = isHighVariation(num, info.allVals);
        const lo = isLowVariation(num, info.allVals);
        if (!hi && !lo) return;
        const desvPct = ((num - avg) / avg * 100).toFixed(1);

        // Historical comparison
        const histPrice = historicalMap[cp.produto_id]?.[f.id];
        let precoAnterior = "—";
        let variacaoHist = "—";
        if (histPrice !== undefined) {
          precoAnterior = `R$ ${formatNumber(histPrice)}`;
          const histVar = ((num - histPrice) / histPrice * 100).toFixed(1);
          variacaoHist = `${Number(histVar) > 0 ? "+" : ""}${histVar}%`;
        }

        rows.push({
          Produto: cp.produto?.nome || "",
          Embalagem: cp.produto?.embalagem || "un",
          Fornecedor: f.nome,
          Preço: num,
          Média: formatNumber(avg),
          Desvio: `${desvPct}%`,
          Tipo: hi ? "⚠️ Acima (+25%)" : "⚠️ Abaixo (-15%)",
          "Preço Anterior": precoAnterior,
          "Variação Histórica": variacaoHist,
        });
      });
    });
    return rows;
  };

  const exportSuspiciousReport = () => {
    const rows = buildSuspiciousReport();
    if (!rows.length) {
      toast.info("Nenhum preço suspeito detectado nesta cotação.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos");
    XLSX.writeFile(wb, `precos-suspeitos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Relatório exportado com ${rows.length} preço(s) suspeito(s).`);
  };

  const handleNovaCotacao = async () => {
    if (!novaCotacaoOpt || !cotacaoAtiva) return;
    try {
      const suspiciousRows = buildSuspiciousReport();
      if (suspiciousRows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(suspiciousRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos");
        XLSX.writeFile(wb, `precos-suspeitos-${cotacaoAtiva.nome.replace(/\s+/g, "-")}.xlsx`);
        toast.info(`${suspiciousRows.length} preço(s) suspeito(s) exportado(s) automaticamente.`);
      }

      await supabase.from("cotacoes").update({ status: "finalizada", finalizada_at: new Date().toISOString() }).eq("id", cotacaoAtiva.id);
      const { data: newCot, error } = await supabase.from("cotacoes").insert({ nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`, status: "ativa", loja_id: lojaAtiva?.id || null } as any).select().single();
      if (error) throw error;

      if ((novaCotacaoOpt === "manter" || novaCotacaoOpt === "manter_precos") && newCot) {
        const { data: newCps } = await supabase.from("cotacao_produtos").insert(
          cotacaoProdutos.map((cp) => ({
            cotacao_id: newCot.id,
            produto_id: cp.produto_id,
            quantidade: cp.quantidade,
          }))
        ).select();

        // Import prices from previous cotação
        if (novaCotacaoOpt === "manter_precos" && newCps?.length) {
          const priceInserts: { cotacao_produto_id: string; fornecedor_id: string; preco: number }[] = [];
          for (const newCp of newCps) {
            const oldCp = cotacaoProdutos.find((cp) => cp.produto_id === newCp.produto_id);
            if (!oldCp) continue;
            const oldPrices = precos.filter((p) => p.cotacao_produto_id === oldCp.id && p.preco !== null);
            for (const op of oldPrices) {
              priceInserts.push({
                cotacao_produto_id: newCp.id,
                fornecedor_id: op.fornecedor_id,
                preco: op.preco!,
              });
            }
          }
          if (priceInserts.length) {
            await supabase.from("precos").insert(priceInserts);
          }
          toast.success("Nova cotação com preços importados!");
        } else {
          toast.success("Nova cotação iniciada — preços limpos!");
        }
      } else {
        toast.success("Cotação reiniciada — lista zerada!");
      }

      queryClient.invalidateQueries();
      setNovaCotacaoOpen(false);
      setNovaCotacaoOpt(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFieldBlur = (cpId: string, field: string, value: string, original: string) => {
    if (value.trim() !== original.trim()) {
      if (field === "quantidade") {
        updateCpMutation.mutate({ cpId, field, value: parseFloat(value) || 1 });
      } else {
        updateCpMutation.mutate({ cpId, field, value: value.trim() });
      }
    }
    setEditingField((prev) => {
      const copy = { ...prev };
      if (copy[cpId]) {
        delete copy[cpId][field as keyof typeof copy[typeof cpId]];
        if (!Object.keys(copy[cpId]).length) delete copy[cpId];
      }
      return copy;
    });
  };

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAllSuppliers = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    allFornecedores.forEach((f) => { updated[f.id] = val; });
    setSelectedSuppliers(updated);
  };

  const saveSupplierSelection = async () => {
    if (!cotacaoAtiva?.id) return;
    const selectedIds = Object.entries(selectedSuppliers).filter(([, v]) => v).map(([id]) => id);
    await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotacaoAtiva.id);
    if (selectedIds.length) {
      await supabase.from("cotacao_fornecedores").insert(
        selectedIds.map((fid) => ({ cotacao_id: cotacaoAtiva.id, fornecedor_id: fid }))
      );
    }
    queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
    setSupplierModalOpen(false);
    toast.success("Seleção de fornecedores salva!");
  };

  const runQtySuggestion = async () => {
    if (!cotacaoAtiva?.id) return;
    setQtySuggestLoading(true);
    setQtySuggestOpen(true);
    setQtySuggestions([]);
    try {
      const resp = await supabase.functions.invoke("ai-automacao", {
        body: { type: "suggest-quantities", cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id || null },
      });
      if (resp.error) throw new Error(resp.error.message);
      setQtySuggestions(resp.data?.suggestions || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao sugerir quantidades");
    }
    setQtySuggestLoading(false);
  };

  const applyQtySuggestions = async () => {
    let applied = 0;
    for (const s of qtySuggestions) {
      if (s.cotacao_produto_id && s.quantidade_sugerida) {
        const { error } = await supabase.from("cotacao_produtos").update({ quantidade: s.quantidade_sugerida }).eq("id", s.cotacao_produto_id);
        if (!error) applied++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
    setQtySuggestOpen(false);
    if (applied > 0) {
      toast.success(`${applied} quantidades atualizadas com sugestões da IA!`);
    } else {
      toast.error("Nenhuma quantidade pôde ser aplicada. Verifique se há produtos na cotação.");
    }
  };

  const runAiAnalysis = async () => {
    if (!cotacaoAtiva?.id) return;
    setAiAnalysisOpen(true);
    setAiAnalysisText("");
    setAiAnalysisLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-precos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ cotacao_id: cotacaoAtiva.id }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro na análise de IA");
        setAiAnalysisLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAiAnalysisText(fullText);
            }
          } catch { /* partial JSON */ }
        }
      }
      // flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAiAnalysisText(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na análise");
    } finally {
      setAiAnalysisLoading(false);
    }
  };


  if (!cotacaoAtiva) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <p className="text-lg font-semibold mb-2">Nenhuma cotação ativa</p>
        <p className="text-sm">Crie uma nova cotação para começar.</p>
        <Button className="mt-4 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]" onClick={async () => {
          const { error } = await supabase.from("cotacoes").insert({ nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`, status: "ativa", loja_id: lojaAtiva?.id || null } as any);
          if (error) toast.error(error.message);
          else { queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] }); toast.success("Cotação criada!"); }
        }}>
          + Nova Cotação
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="p-3 border-b bg-card flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button
          variant={filterAnomalies ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterAnomalies(!filterAnomalies)}
          className={filterAnomalies ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
        >
          <Filter className="h-4 w-4 mr-1" /> {filterAnomalies ? "Anomalias" : "Filtrar ▲▼"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSupplierModalOpen(true)}>
          <Users className="h-4 w-4 mr-1" /> Fornecedores ({fornecedores.length})
        </Button>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={exportSuspiciousReport}>
          <FileWarning className="h-4 w-4 mr-1" /> Suspeitos
        </Button>
        <Button variant="outline" size="sm" onClick={runAiAnalysis} disabled={aiAnalysisLoading}>
          {aiAnalysisLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Análise IA
        </Button>
        <Button variant="outline" size="sm" onClick={runQtySuggestion} disabled={qtySuggestLoading}>
          {qtySuggestLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
          Sugerir Qtd
        </Button>
        <Button size="sm" onClick={saveAll} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Nova cotação strip */}
      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-3 flex-wrap">
        <p className="text-xs text-amber-700 flex-1">💡 Inicie uma nova rodada — salva o histórico e limpa os preços.</p>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs" onClick={() => setNovaCotacaoOpen(true)}>
          🔄 Nova Cotação
        </Button>
      </div>

      {/* Legend */}
      {legendVisible && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/50 border-b text-[10px] flex-wrap">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">Legenda:</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-blue-600 font-extrabold text-[10px]">R$0,00</span> Menor preço
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span> Empate
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-amber-500 text-white text-[7px] font-extrabold px-1 rounded">2º</span> Segundo menor
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded">▲</span> +25% acima
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-red-500 to-red-700 text-white text-[7px] font-extrabold px-1 rounded">▼</span> -15% abaixo (discrepância)
          </span>
          <button onClick={() => setLegendVisible(false)} className="ml-auto text-muted-foreground hover:text-foreground">✕ ocultar</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap sticky left-0 bg-muted z-20">
                Produto
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-16">Embal</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-14">QT</th>
              {fornecedores.map((f) => {
                const hasPrice = precos.some((p) => p.fornecedor_id === f.id && p.preco !== null && p.preco > 0);
                return (
                  <th key={f.id} className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap min-w-[100px]">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${hasPrice ? "bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,.2)]" : "bg-muted-foreground/30"}`} />
                      <span>{f.nome}</span>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-blue-600 border-b-2 border-border">MIN</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700 border-b-2 border-border">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={fornecedores.length + 5} className="text-center py-10 text-muted-foreground">
                {filterAnomalies ? "Nenhum item com anomalia de preço detectada." : cotacaoProdutos.length === 0 ? "Nenhum produto na cotação. Adicione produtos pelo Banco de Produtos." : "Nenhum produto encontrado."}
              </td></tr>
            ) : filteredItems.map((cp) => {
              const info = analyzePrices(cp.id);
              const totalLine = info.minVal !== null ? info.minVal * (cp.quantidade || 1) : null;

              return (
                <tr key={cp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 border-b font-medium text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                    <Input
                      className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent w-full min-w-[120px]"
                      defaultValue={cp.produto?.nome || ""}
                      onBlur={(e) => handleFieldBlur(cp.id, "nome", e.target.value, cp.produto?.nome || "")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-16 mx-auto"
                      defaultValue={cp.produto?.embalagem || "un"}
                      onBlur={(e) => handleFieldBlur(cp.id, "embalagem", e.target.value, cp.produto?.embalagem || "un")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-14 mx-auto"
                      type="number"
                      defaultValue={cp.quantidade || 1}
                      onBlur={(e) => handleFieldBlur(cp.id, "quantidade", e.target.value, String(cp.quantidade || 1))}
                    />
                  </td>
                  {fornecedores.map((f) => {
                    const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
                    const numVal = rawVal ? parseFloat(rawVal) : null;
                    const isMin = numVal !== null && info.minVal !== null && numVal === info.minVal;
                    const isTieMin = isMin && info.tiedCount > 1;
                    const isSecond = info.second === f.id;
                    const hiVar = numVal !== null && isHighVariation(numVal, info.allVals);
                    const loVar = numVal !== null && isLowVariation(numVal, info.allVals);

                    let inputClass = "w-20 text-right font-mono text-xs h-8 px-2";
                    if (isMin) inputClass += " font-bold text-blue-600 border-blue-200 bg-blue-50/50";
                    else if (isSecond) inputClass += " price-second";
                    if (hiVar && !isMin) inputClass += " price-high-var";
                    if (loVar && !isMin) inputClass += " price-low-var";

                    return (
                      <td key={f.id} className="px-1 py-1 border-b text-center">
                        <div className="relative inline-flex items-center">
                          <Input
                            type="text"
                            placeholder="—"
                            value={localPrices[cp.id]?.[f.id] || ""}
                            onChange={(e) => handlePriceChange(cp.id, f.id, e.target.value)}
                            onBlur={() => handlePriceBlur(cp.id, f.id)}
                            className={inputClass}
                           />
                           {isTieMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span>}
                           {isSecond && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[6px] font-extrabold px-1 rounded">2º</span>}
                           {hiVar && !isMin && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <span className="absolute -bottom-1.5 -right-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▲</span>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs text-xs">
                                 <p className="font-bold">⚠️ Preço muito acima da média</p>
                                 <p className="text-[11px] mt-1">+25% acima dos demais fornecedores. Verifique se há erro de digitação.</p>
                               </TooltipContent>
                             </Tooltip>
                           )}
                           {loVar && !isMin && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <span className="absolute -bottom-1.5 -left-1 bg-gradient-to-r from-red-500 to-red-700 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▼</span>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs text-xs">
                                 <p className="font-bold">⚠️ Discrepância de preço</p>
                                 <p className="text-[11px] mt-1">-15% abaixo da média. Verifique possível erro de digitação ou unidade.</p>
                               </TooltipContent>
                             </Tooltip>
                           )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-blue-600">
                    {info.minVal !== null ? `R$${formatNumber(info.minVal)}` : "-"}
                  </td>
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-amber-700">
                    {totalLine !== null ? formatBRL(totalLine) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total bar */}
      <div className="border-t bg-card px-5 py-3 flex items-center justify-end gap-4 shadow-[0_-4px_20px_rgba(15,20,34,.08)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total da Compra</span>
        <span className="text-xl font-extrabold text-blue-600 font-mono tracking-tight">{formatBRL(grandTotal)}</span>
      </div>

      {/* Supplier Selection Modal */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>👥 Fornecedores da Cotação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione quais fornecedores participam desta cotação. Apenas os selecionados aparecem na tabela e nos cálculos.</p>
          <div className="flex items-center gap-3 mt-2 mb-1">
            <Button variant="outline" size="sm" onClick={() => selectAllSuppliers(true)}>Selecionar todos</Button>
            <Button variant="outline" size="sm" onClick={() => selectAllSuppliers(false)}>Desmarcar todos</Button>
          </div>
          <div className="space-y-2 max-h-[350px] overflow-y-auto mt-2">
            {allFornecedores.map((f) => (
              <label
                key={f.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedSuppliers[f.id] !== false ? "border-primary/30 bg-primary/5" : "border-border hover:border-muted-foreground/30 opacity-60"}`}
                onClick={() => toggleSupplier(f.id)}
              >
                <Checkbox
                  checked={selectedSuppliers[f.id] !== false}
                  onCheckedChange={() => toggleSupplier(f.id)}
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">{f.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.representante && `${f.representante}`}
                    {f.telefone && ` · ${f.telefone}`}
                    {f.pedido_minimo && f.pedido_minimo > 0 ? ` · mín: ${formatBRL(f.pedido_minimo)}` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveSupplierSelection} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              Salvar Seleção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova Cotação Modal */}
      <Dialog open={novaCotacaoOpen} onOpenChange={setNovaCotacaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔄 Nova Cotação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Salva o histórico atual e reinicia a cotação</p>
          <p className="text-sm text-foreground mt-2">O que deseja fazer com a <strong>lista de produtos</strong>?</p>
          <div className="space-y-3 mt-2">
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "manter_precos" ? "border-[hsl(var(--brand))] bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
              onClick={() => setNovaCotacaoOpt("manter_precos")}
            >
              <input type="radio" name="nc" checked={novaCotacaoOpt === "manter_precos"} readOnly className="mt-1 accent-[hsl(var(--brand))]" />
              <div>
                <div className="text-sm font-bold">Manter itens + importar preços</div>
                <div className="text-xs text-muted-foreground">Copia os produtos e os preços atuais para a nova cotação.</div>
              </div>
            </label>
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "manter" ? "border-[hsl(var(--brand))] bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
              onClick={() => setNovaCotacaoOpt("manter")}
            >
              <input type="radio" name="nc" checked={novaCotacaoOpt === "manter"} readOnly className="mt-1 accent-[hsl(var(--brand))]" />
              <div>
                <div className="text-sm font-bold">Manter lista de itens</div>
                <div className="text-xs text-muted-foreground">Apenas limpa os preços. Os produtos permanecem.</div>
              </div>
            </label>
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "zerar" ? "border-destructive bg-red-50" : "border-border hover:border-muted-foreground/30"}`}
              onClick={() => setNovaCotacaoOpt("zerar")}
            >
              <input type="radio" name="nc" checked={novaCotacaoOpt === "zerar"} readOnly className="mt-1 accent-red-600" />
              <div>
                <div className="text-sm font-bold">Zerar tudo — lista nova</div>
                <div className="text-xs text-muted-foreground">Remove todos os produtos e preços. Começa do zero.</div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaCotacaoOpen(false)}>Cancelar</Button>
            <Button onClick={handleNovaCotacao} disabled={!novaCotacaoOpt} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={aiAnalysisOpen} onOpenChange={setAiAnalysisOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análise Inteligente de Preços
            </DialogTitle>
          </DialogHeader>
          <div ref={aiScrollRef} className="flex-1 overflow-y-auto pr-2 min-h-[200px]">
            {aiAnalysisLoading && !aiAnalysisText && (
              <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analisando preços com IA...</span>
              </div>
            )}
            {aiAnalysisText && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{aiAnalysisText}</ReactMarkdown>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiAnalysisOpen(false)}>Fechar</Button>
            <Button onClick={runAiAnalysis} disabled={aiAnalysisLoading} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              {aiAnalysisLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Reanalisar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quantity Suggestion Dialog */}
      <Dialog open={qtySuggestOpen} onOpenChange={setQtySuggestOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Sugestão de Quantidades (IA)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {qtySuggestLoading && (
              <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analisando histórico...</span>
              </div>
            )}
            {!qtySuggestLoading && qtySuggestions.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma sugestão disponível.</p>
            )}
            {qtySuggestions.length > 0 && (
              <div className="space-y-2">
                {qtySuggestions.map((s, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.nome}</span>
                      <span className="text-primary font-bold text-sm">Qtd: {s.quantidade_sugerida}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.justificativa}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQtySuggestOpen(false)}>Cancelar</Button>
            <Button onClick={applyQtySuggestions} disabled={!qtySuggestions.length} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              Aplicar Sugestões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default CotacaoPage;
