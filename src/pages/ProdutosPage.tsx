import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchInputComScanner from "@/components/shared/SearchInputComScanner";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Trash2, Check, Upload, ChevronLeft, Sparkles, Loader2, MoreHorizontal, ArrowRight, Package, X, Filter, ScanBarcode } from "lucide-react";
import BarcodeScannerModal from "@/components/shared/BarcodeScannerModal";
import ProdutoSheet, { type ProdutoSheetItem } from "@/components/produtos/ProdutoSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import ImportProdutosModal from "@/components/ImportProdutosModal";
import CatalogoBaseModal from "@/components/CatalogoBaseModal";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";
import type { Tables } from "@/integrations/supabase/types";
import BackToLojaButton from "@/components/shared/BackToLojaButton";
import { useProdutosHibrido } from "@/hooks/useProdutosHibrido";
import { buildSnapshotInsert, type ProdutoHibrido } from "@/lib/buscaProdutos";


type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };
type Categoria = Tables<"categorias">;

import { EMBALAGEM_SIGLAS } from "@/lib/embalagem";
import { FATOR_PADRAO, matchEmbalagem } from "@/lib/embalagemFatores";
import { autoSuggestFator } from "@/lib/autoFator";
import AdicionarItemDialog from "@/components/shared/AdicionarItemDialog";
const EMBALAGEM_OPTIONS = EMBALAGEM_SIGLAS;

/** Chave única no Set itensNaCotacao — distingue local vs catálogo. */
const cotacaoKey = (fonte: "local" | "catalogo", id: string) =>
  `${fonte === "catalogo" ? "cat" : "local"}:${id}`;

/** Converte um Produto local no formato ProdutoHibrido para reaproveitar buildSnapshotInsert. */
const produtoToHibrido = (p: Produto): ProdutoHibrido => ({
  fonte: "local",
  id: p.id,
  nome: p.nome,
  ean: null,
  embalagem: p.embalagem ?? null,
  fator_embalagem: (p as any).fator_embalagem ?? null,
});
const emptyForm = { nome: "", ean: "", categoria_id: "", embalagem: "UNI", quantidade: 1, fator_embalagem: 1 };

/** Mantém apenas dígitos; string vazia quando não há nada válido. */
export const normalizeEan = (value: string | null | undefined) => (value || "").replace(/\D/g, "");
const PAGE_SIZE = 80;

const cleanEmbalagem = (raw: string | null | undefined) => raw?.split("|")[0].trim() || "un";

const normalizeProductName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const ProdutosPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const { checkLimit, checkPlan, showPlanos, setShowPlanos } = useFeatureCheck();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [eanScannerOpen, setEanScannerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showFooter, setShowFooter] = useState(false);
  const [prevCotacaoCount, setPrevCotacaoCount] = useState<number | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Gestor IA
  const [gestorOpen, setGestorOpen] = useState(false);
  const [gestorBadge, setGestorBadge] = useState(0);
  const [gestorLoading, setGestorLoading] = useState(false);
  const [gestorResult, setGestorResult] = useState<{
    semCategoria: number;
    duplicatas: number;
  } | null>(null);

  // AI classify modal state
  const [classifyModalOpen, setClassifyModalOpen] = useState(false);
  const [classifyStatus, setClassifyStatus] = useState<"running" | "done" | "error">("running");
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [classifyResult, setClassifyResult] = useState({ updated: 0, categories: 0 });
  const [classifyError, setClassifyError] = useState("");
  const [classifyMode, setClassifyMode] = useState<"classify" | "fator">("classify");

  // Diálogo unificado — carrega ProdutoHibrido (local ou catálogo) + metadados de exibição
  const [dialogState, setDialogState] = useState<{ produto: ProdutoHibrido; subtitulo?: string | null } | null>(null);


  // Sheet de opções do produto (editar / excluir)
  const [sheetProduto, setSheetProduto] = useState<Produto | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const {
    data: produtosData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["produtos", search, selectedCat],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("produtos")
        .select("*, categorias(nome)", { count: "exact" })
        .order("nome")
        .range(from, to);

      const termo = search.trim();
      if (termo) {
        if (/^\d+$/.test(termo)) {
          // Termo numérico → busca por nome OU código de barras (prefixo)
          query = query.or(`nome.ilike.%${termo}%,ean.ilike.${termo}%`);
        } else {
          query = query.ilike("nome", `%${termo}%`);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const totalCount = count ?? 0;
      const hasMore = from + PAGE_SIZE < totalCount;
      return {
        products: data as Produto[],
        nextPage: hasMore ? pageParam + 1 : undefined,
        totalCount,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
  // Busca híbrida: catálogo global (search_produtos_hibrido). Sem termo → hook devolve [].
  const { catalogo: catalogoHibrido, isLoading: catalogoLoading } = useProdutosHibrido({
    termo: search,
    minLength: 2,
  });


  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("id").eq("status", "ativa").limit(1);
      if (lojaAtiva?.id) {
        query = query.eq("loja_id", lojaAtiva.id);
      }
      const { data } = await query.maybeSingle();
      return data;
    },
  });

  const { data: cotacaoItens = [] } = useQuery({
    queryKey: ["cotacao-produto-ids", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cotacao_produtos")
        .select("produto_id, catalogo_mestre_id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      return (data ?? []) as { produto_id: string | null; catalogo_mestre_id: string | null }[];
    },
  });

  const itensNaCotacao = useMemo(() => {
    const s = new Set<string>();
    for (const i of cotacaoItens) {
      if (i.produto_id) s.add(cotacaoKey("local", i.produto_id));
      if (i.catalogo_mestre_id) s.add(cotacaoKey("catalogo", i.catalogo_mestre_id));
    }
    return s;
  }, [cotacaoItens]);
  const cotacaoItemCount = itensNaCotacao.size;


  useEffect(() => {
    if (cotacaoItemCount > 0 && !showFooter) {
      setShowFooter(true);
    }
    if (prevCotacaoCount === 0 && cotacaoItemCount === 1) {
      toast.success("🎉 Primeiro produto adicionado! Continue selecionando.");
    }
    setPrevCotacaoCount(cotacaoItemCount);
  }, [cotacaoItemCount]);

  const produtos = useMemo(
    () => produtosData?.pages.flatMap((p) => p.products) ?? [],
    [produtosData]
  );

  const totalCount = produtosData?.pages[0]?.totalCount ?? 0;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const createCatMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("categorias").insert({ nome: nome.trim(), user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      setNewCatModalOpen(false);
      setNewCatName("");
      toast.success("Categoria criada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        ean: normalizeEan(form.ean) || null,
        categoria_id: form.categoria_id || null,
        embalagem: cleanEmbalagem(form.embalagem),
        fator_embalagem: form.fator_embalagem || 1,
      };
      if (editingId) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert({ ...payload, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setSelectedCat("Todos");
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      toast.success(editingId ? "Produto atualizado!" : "Produto adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cleanOrphanCategories = async () => {
    const { data: allCats } = await supabase.from("categorias").select("id").eq("user_id", user?.id);
    if (!allCats?.length) return;
    const { fetchAllUsedCategoryIds } = await import("@/lib/supabaseHelpers");
    const usedIds = await fetchAllUsedCategoryIds(user?.id!);
    const orphans = allCats.filter((c) => !usedIds.has(c.id)).map((c) => c.id);
    if (orphans.length) {
      await supabase.from("categorias").delete().in("id", orphans);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
      await cleanOrphanCategories();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success("Produto removido!");
      setDeleteConfirmId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("produtos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      await supabase.from("categorias").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success("Todos os produtos e categorias foram removidos!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleCotacaoMutation = useMutation({
    mutationFn: async ({
      produto,
      adding,
      quantidade = 1,
      tipoEmbalagem,
      fatorEmbalagem,
    }: {
      produto: ProdutoHibrido;
      adding: boolean;
      quantidade?: number;
      tipoEmbalagem?: string;
      fatorEmbalagem?: number;
    }) => {
      if (adding) {
        // Auto-create an active cotação if none exists
        let cotacaoId = cotacaoAtiva?.id;
        if (!cotacaoId) {
          const { format } = await import("date-fns");
          const cotNome = `Cotação ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
          const { data: newCot, error: cotErr } = await supabase
            .from("cotacoes")
            .insert({
              nome: cotNome,
              loja_id: lojaAtiva?.id || null,
              created_by: user?.id,
            })
            .select("id")
            .single();
          if (cotErr) throw cotErr;
          cotacaoId = newCot.id;
        }
        // Fonte única do snapshot (nome/ean/embalagem/fator) — src/lib/buscaProdutos.ts
        const snap = buildSnapshotInsert({
          cotacaoId,
          produto,
          quantidade,
          embalagem: tipoEmbalagem,
          fator: fatorEmbalagem,
        });
        const { error } = await supabase.from("cotacao_produtos").insert(snap as any);
        if (error) throw error;
      } else if (!adding && cotacaoAtiva) {
        let del = supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotacaoAtiva.id);
        if (produto.fonte === "catalogo") {
          del = del.eq("catalogo_mestre_id", produto.id);
        } else {
          del = del.eq("produto_id", produto.id);
        }
        const { error } = await del;
        if (error) throw error;
      }
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produto-ids"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
      toast.success(variables.adding ? "Produto adicionado à cotação!" : "Produto removido da cotação");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar à cotação"),
  });

  // --- Duplicate removal ---
  const removeDuplicates = async () => {
    // Fetch ALL products (bypassing 1000-row default limit)
    let allProducts: { id: string; nome: string; created_at: string }[] = [];
    let from = 0;
    const batchSize = 1000;
    let error: any = null;
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from("produtos")
        .select("id, nome, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: true })
        .range(from, from + batchSize - 1);
      if (fetchErr) { error = fetchErr; break; }
      if (!data || data.length === 0) break;
      allProducts = allProducts.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    if (error || !allProducts) {
      toast.error("Erro ao buscar produtos");
      return;
    }
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const p of allProducts) {
      const key = p.nome.toLowerCase().trim();
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }
    if (toDelete.length === 0) {
      toast.info("Nenhuma duplicata encontrada");
      return;
    }
    // Delete in batches to avoid query size limits
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      const { error: delError } = await supabase.from("produtos").delete().in("id", batch);
      if (delError) {
        toast.error("Erro ao remover duplicatas");
        return;
      }
    }
    await cleanOrphanCategories();
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
    toast.success(`${toDelete.length} duplicata${toDelete.length > 1 ? "s" : ""} removida${toDelete.length > 1 ? "s" : ""} com sucesso!`);
  };

  const runGestorAnalise = async () => {
    setGestorLoading(true);
    setGestorResult(null);
    const semCat = produtos.filter(p => !p.categoria_id).length;
    const seen = new Set<string>();
    let dupCount = 0;
    for (const p of produtos) {
      const key = normalizeProductName(p.nome);
      if (seen.has(key)) dupCount++;
      else seen.add(key);
    }
    const total = semCat + dupCount;
    setGestorBadge(total);
    setGestorResult({ semCategoria: semCat, duplicatas: dupCount });
    setGestorLoading(false);
  };

  const filtered = useMemo(() => produtos.filter((p) => {
    const matchCat = selectedCat === "Todos" || p.categorias?.nome === selectedCat;
    return matchCat;
  }), [produtos, selectedCat]);

  const grouped = filtered.reduce<Record<string, Produto[]>>((acc, p) => {
    const cat = p.categorias?.nome || "Sem Categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const catCounts = produtos.reduce<Record<string, number>>((acc, p) => {
    const cat = p.categorias?.nome || "Sem Categoria";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const openAdd = () => {
    if (!checkLimit("max_produtos", totalCount, "Faça upgrade para cadastrar mais produtos.")) return;
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Produto) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      ean: (p as any).ean || "",
      categoria_id: p.categoria_id || "",
      embalagem: p.embalagem || "UNI",
      quantidade: 1,
      fator_embalagem: (p as any).fator_embalagem || 1,
    });
    setModalOpen(true);
  };

  // --- Helper to chunk arrays ---
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  // --- AI Classify with progress modal (frontend batching) ---
  const autoClassifyProducts = async () => {
    const uncategorized = produtos.filter((p) => !p.categoria_id);
    const targets = uncategorized.length > 0 ? uncategorized : filtered;
    if (!targets.length) {
      toast.info("Nenhum produto para classificar.");
      return;
    }

    setClassifyModalOpen(true);
    setClassifyMode("classify");
    setClassifyStatus("running");
    setClassifyProgress(0);
    setClassifyError("");
    setClassifyResult({ updated: 0, categories: 0 });

    const FRONTEND_BATCH = 150;
    let currentCatNames = categorias.map((c) => c.nome);
    let totalUpdated = 0;

    try {
      const batches = chunkArray(targets, FRONTEND_BATCH);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setClassifyProgress(Math.round((i / batches.length) * 80));

        const resp = await supabase.functions.invoke("ai-automacao", {
          body: {
            type: "classify-products",
            products: batch.map((p) => ({ nome: p.nome })),
            existing_categories: currentCatNames,
          },
        });

        if (resp.error) throw new Error(resp.error.message);

        const classifications: { nome?: string; categoria?: string }[] = resp.data?.classifications || [];
        if (!classifications.length) continue;

        // Refresh category map from DB
        const catMap: Record<string, string> = {};
        categorias.forEach((c) => { catMap[c.nome.toLowerCase()] = c.id; });
        const { data: freshCats } = await supabase.from("categorias").select("id, nome").order("nome");
        (freshCats || []).forEach((c: any) => { catMap[c.nome.toLowerCase()] = c.id; });

        // Create new categories
        const newCatNames = classifications
          .map((c) => String(c.categoria || "").trim())
          .filter((name) => name && !catMap[name.toLowerCase()]);
        const uniqueNewCats = Array.from(new Set(newCatNames));

        for (const catName of uniqueNewCats) {
          const { data, error } = await supabase
            .from("categorias")
            .insert([{ nome: catName, user_id: user?.id }])
            .select("id, nome")
            .single();
          if (!error && data) {
            catMap[catName.toLowerCase()] = data.id;
            currentCatNames.push(catName);
          }
        }

        // Update products in this batch
        for (const cl of classifications) {
          const catId = catMap[cl.categoria?.toLowerCase() || ""];
          if (!catId) continue;
          const prod = batch.find((p) => normalizeProductName(p.nome) === normalizeProductName(cl.nome || ""));
          if (prod) {
            const { error } = await supabase
              .from("produtos")
              .update({ categoria_id: catId })
              .eq("id", prod.id);
            if (!error) totalUpdated++;
          }
        }

        // Refresh UI after each batch
        queryClient.invalidateQueries({ queryKey: ["produtos"] });
        queryClient.invalidateQueries({ queryKey: ["categorias"] });
      }

      setClassifyProgress(100);
      setClassifyResult({ updated: totalUpdated, categories: 0 });
      setClassifyStatus("done");
      toast.success(`🤖 ${totalUpdated} produtos classificados pela IA!`);
    } catch (e: any) {
      setClassifyError(e.message || "Erro na classificação automática");
      setClassifyStatus("error");
      toast.error(e.message || "Erro na classificação automática");
    }
  };

  // --- AI Suggest Fator ---
  const autoSuggestFatorProducts = async () => {
    // Target products with fator = 1 (default), or all if none qualify
    const candidates = produtos.filter(p => (p.fator_embalagem || 1) === 1);
    const targets = candidates.length > 0 ? candidates : filtered;
    if (!targets.length) {
      toast.info("Nenhum produto para analisar.");
      return;
    }

    setClassifyModalOpen(true);
    setClassifyMode("fator");
    setClassifyStatus("running");
    setClassifyProgress(10);
    setClassifyError("");
    setClassifyResult({ updated: 0, categories: 0 });

    try {
      setClassifyProgress(30);
      const updated = await autoSuggestFator(
        targets.map(p => ({ id: p.id, nome: p.nome, embalagem: p.embalagem || "UNI", fator_embalagem: p.fator_embalagem || 1 })),
        {
          skipIfAlreadySet: false,
          onProgress: (done, total) => setClassifyProgress(30 + Math.round((done / total) * 60)),
        }
      );

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setClassifyProgress(100);
      setClassifyResult({ updated, categories: 0 });
      setClassifyStatus("done");
    } catch (e: any) {
      setClassifyError(e.message || "Erro ao sugerir fatores");
      setClassifyStatus("error");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-3 border-b bg-card/80 space-y-2">
          <BackToLojaButton className="mb-0" />
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground">Banco de Produtos</h1>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" /> Novo Produto
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="text-xs">Mais</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => {
                    if (!checkPlan("pro", "Importação em massa")) return;
                    setImportOpen(true);
                  }}>
                    <Upload className="h-4 w-4 mr-2" /> Importar Produtos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCatalogoOpen(true)}>
                    <Package className="h-4 w-4 mr-2" /> Catálogo Supermercado
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setGestorOpen(true)}
                    disabled={produtos.length === 0}
                  >
                    <div className="flex items-center flex-1">
                      <Sparkles className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">Gestor IA</span>
                      {gestorBadge > 0 && (
                        <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          {gestorBadge}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteAllConfirm(true)}
                    disabled={deleteAllMutation.isPending || produtos.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Todos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search com scanner de código de barras */}
          <div className="flex items-center gap-2">
            <SearchInputComScanner
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="Buscar por nome ou código de barras"
              className="flex-1 min-w-0"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {filtered.length}/{totalCount}
            </span>
          </div>


          {/* Filtro de categoria */}
          <button
            onClick={() => setCatSheetOpen(true)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
              selectedCat !== "Todos"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Filter className="h-4 w-4 shrink-0" />
            <span className="truncate flex-1 text-left">
              {selectedCat === "Todos" ? "Todas as categorias" : selectedCat}
            </span>
            {selectedCat !== "Todos" ? (
              <span
                onClick={(e) => { e.stopPropagation(); setSelectedCat("Todos"); }}
                className="text-xs text-primary hover:underline shrink-0"
              >
                ✕ limpar
              </span>
            ) : (
              <span className="text-xs text-muted-foreground shrink-0">
                {categorias.length} categorias
              </span>
            )}
          </button>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto ${cotacaoItemCount > 0 ? "pb-24" : ""}`}>
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 && catalogoHibrido.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              {catalogoLoading ? "Buscando..." : "Nenhum produto encontrado."}
            </div>
          ) : (
            <>
              {filtered.length > 0 && (
                <>
                  {search.trim().length >= 2 && (
                    <div className="px-4 py-1.5 bg-primary/5 text-[10px] font-bold uppercase tracking-wider text-primary sticky top-0 z-10 border-b">
                      Seus produtos
                    </div>
                  )}
                  {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, prods]) => (
                    <div key={cat}>
                      {selectedCat === "Todos" && (
                        <div className="px-4 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10 border-b">
                          {cat}
                        </div>
                      )}
                      {prods.map((p) => {
                        const inCotacao = itensNaCotacao.has(cotacaoKey("local", p.id));
                        return (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir opções de ${p.nome}`}
                            onClick={() => setSheetProduto(p)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSheetProduto(p);
                              }
                            }}
                            className={`flex items-center gap-2 px-3 py-2.5 border-b hover:bg-muted/30 transition-all cursor-pointer focus:outline-none focus:bg-muted/40 ${
                              inCotacao ? "border-l-2 border-l-primary bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{p.nome}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {p.categorias?.nome || "Sem Categoria"} · {p.embalagem || "un"}
                                {(p as any).ean ? ` · EAN ${(p as any).ean}` : ""}
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-1 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inCotacao ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 transition-all bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                  onClick={() => toggleCotacaoMutation.mutate({ produto: produtoToHibrido(p), adding: false })}
                                >
                                  ✓
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white"
                                  onClick={() => setDialogState({ produto: produtoToHibrido(p), subtitulo: p.categorias?.nome ?? null })}
                                  aria-label={`Adicionar ${p.nome} à cotação`}
                                >
                                  +
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {isFetchingNextPage && (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando mais...
                    </div>
                  )}
                  {!hasNextPage && produtos.length > 0 && (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      {produtos.length} de {totalCount} produtos carregados
                    </div>
                  )}
                </>
              )}

              {/* Catálogo global — só quando há termo de busca (>=2 chars). Sem termo, mantemos apenas locais. */}
              {search.trim().length >= 2 && catalogoHibrido.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 bg-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary sticky top-0 z-10 border-b flex items-center justify-between">
                    <span>Catálogo global</span>
                    <span className="normal-case tracking-normal text-muted-foreground">
                      {catalogoHibrido.length} resultado{catalogoHibrido.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {catalogoHibrido.map((c) => {
                    const inCotacao = itensNaCotacao.has(cotacaoKey("catalogo", c.id));
                    const emb = matchEmbalagem(c.embalagem);
                    const fator = c.fator_embalagem && c.fator_embalagem > 0 ? c.fator_embalagem : (FATOR_PADRAO[emb] ?? 1);
                    return (
                      <div
                        key={`cat-${c.id}`}
                        className={`flex items-center gap-2 px-3 py-2.5 border-b transition-all ${
                          inCotacao ? "border-l-2 border-l-primary bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">{c.nome}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary shrink-0">
                              Catálogo
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {emb} · fator {fator}
                            {c.ean ? ` · EAN ${c.ean}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {inCotacao ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                              onClick={() => toggleCotacaoMutation.mutate({ produto: c, adding: false })}
                            >
                              ✓
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white"
                              onClick={() => setDialogState({ produto: c, subtitulo: c.ean ? `EAN ${c.ean}` : "Catálogo global" })}
                              aria-label={`Adicionar ${c.nome} do catálogo à cotação`}
                            >
                              +
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>


        {/* Fixed footer — next step */}
        {cotacaoItemCount > 0 && (
          <div className={`fixed bottom-14 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-50 ${showFooter ? "animate-fade-in" : ""}`}>
            <Button
              className="w-full h-12 text-base font-bold gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/fornecedores")}
            >
              <Check className="h-5 w-5" />
              Pronto! Selecionar fornecedores
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">
              <Package className="h-3 w-3 inline mr-1" />
              {cotacaoItemCount} produto{cotacaoItemCount !== 1 ? "s" : ""} selecionado{cotacaoItemCount !== 1 ? "s" : ""} para cotação
            </p>
          </div>
        )}
      </div>

      {/* Sheet de opções do produto */}
      <ProdutoSheet
        produto={sheetProduto as ProdutoSheetItem | null}
        open={!!sheetProduto}
        onOpenChange={(o) => { if (!o) setSheetProduto(null); }}
        onEdit={(prod) => openEdit(prod as Produto)}
        onDelete={(prod) => {
          setDeleteConfirmId(prod.id);
          setDeleteConfirmName(prod.nome);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>"{deleteConfirmName}"</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Classify Progress Modal */}
      <Dialog
        open={classifyModalOpen}
        onOpenChange={(open) => {
          if (!open && classifyStatus === "running") return; // prevent closing while running
          setClassifyModalOpen(open);
        }}
      >
        <DialogContent
          className="max-w-sm"
          onPointerDownOutside={(e) => { if (classifyStatus === "running") e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (classifyStatus === "running") e.preventDefault(); }}
          onInteractOutside={(e) => { if (classifyStatus === "running") e.preventDefault(); }}
        >
          {/* Hide close button while running */}
          {classifyStatus === "running" && (
            <style>{`.classify-modal-content [data-radix-dialog-close] { display: none !important; }`}</style>
          )}
          <div className="classify-modal-content">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {classifyStatus === "running" && <><Sparkles className="h-5 w-5 text-primary animate-pulse" /> Classificando produtos...</>}
                {classifyStatus === "done" && <><span className="text-xl">✅</span> Classificação concluída!</>}
                {classifyStatus === "error" && <><span className="text-xl">❌</span> Erro na classificação</>}
              </DialogTitle>
              <DialogDescription>
                {classifyStatus === "running" && `Analisando ${produtos.filter(p => !p.categoria_id).length || filtered.length} produtos · Aguarde`}
                {classifyStatus === "done" && `${classifyResult.updated} produtos classificados em ${classifyResult.categories} categorias`}
                {classifyStatus === "error" && classifyError}
              </DialogDescription>
            </DialogHeader>

            {classifyStatus === "running" && (
              <div className="py-4">
                <Progress value={classifyProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center mt-2">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                  Processando...
                </p>
              </div>
            )}

            {classifyStatus === "done" && (
              <DialogFooter className="mt-4">
                <Button onClick={() => setClassifyModalOpen(false)}>Fechar</Button>
              </DialogFooter>
            )}

            {classifyStatus === "error" && (
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => setClassifyModalOpen(false)}>Cancelar</Button>
                <Button onClick={autoClassifyProducts}>Tentar Novamente</Button>

              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do Produto *</Label><Input placeholder="Ex: Detergente Ype 500ml" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label htmlFor="produto-ean">Código de barras (EAN)</Label>
              <div className="flex gap-2">
                <Input
                  id="produto-ean"
                  inputMode="numeric"
                  placeholder="Opcional — ex: 7891000100103"
                  value={form.ean}
                  onChange={(e) => setForm({ ...form, ean: normalizeEan(e.target.value) })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label="Escanear código de barras"
                  title="Escanear código de barras"
                  onClick={() => setEanScannerOpen(true)}
                >
                  <ScanBarcode className="h-5 w-5" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Opcional. Escaneie ou digite o código do produto.</p>
            </div>
            <div>
              <Label>Categoria</Label>
              <div className="flex gap-2">
                <select
                  value={form.categoria_id}
                  onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sem categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" onClick={() => setNewCatModalOpen(true)} title="Nova categoria">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Embalagem</Label>
                <select
                  value={form.embalagem}
                  onChange={(e) => {
                    const emb = e.target.value;
                    setForm({ ...form, embalagem: emb, fator_embalagem: FATOR_PADRAO[emb] ?? 1 });
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EMBALAGEM_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <Label>Fator (un)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.fator_embalagem === 0 ? "" : form.fator_embalagem}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm({ ...form, fator_embalagem: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0) })}
                  onBlur={() => setForm(f => ({ ...f, fator_embalagem: f.fator_embalagem < 1 ? 1 : f.fator_embalagem }))}
                  className="h-10 text-center"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5 text-center">un/embalagem</p>
              </div>
            </div>
          </div>
          <BarcodeScannerModal
            open={eanScannerOpen}
            onClose={() => setEanScannerOpen(false)}
            onDetected={(code) => setForm((f) => ({ ...f, ean: normalizeEan(code) }))}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingId && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                onClick={() => {
                  setDeleteConfirmId(editingId);
                  setDeleteConfirmName(form.nome);
                  setModalOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!form.nome.trim()) { toast.error("Digite o nome"); return; } saveMutation.mutate(); }} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Category Modal */}
      <Dialog open={newCatModalOpen} onOpenChange={setNewCatModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div>
            <Label>Nome da Categoria *</Label>
            <Input
              placeholder="Ex: Limpeza, Bebidas..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newCatName.trim() && createCatMutation.mutate(newCatName)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createCatMutation.mutate(newCatName)}
              disabled={!newCatName.trim() || createCatMutation.isPending}
              className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
            >
              Criar Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportProdutosModal
        open={importOpen}
        onOpenChange={setImportOpen}
        categorias={categorias}
      />
      <CatalogoBaseModal open={catalogoOpen} onOpenChange={setCatalogoOpen} />
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />

      {/* Gestor IA Dialog */}
      <Dialog open={gestorOpen} onOpenChange={setGestorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gestor IA de Produtos
            </DialogTitle>
            <DialogDescription>
              Analisa seu banco e sugere melhorias automáticas
            </DialogDescription>
          </DialogHeader>

          {!gestorResult && !gestorLoading && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                O Gestor verifica produtos sem categoria e possíveis duplicatas no seu banco de {totalCount} produtos.
              </p>
              <Button
                className="w-full bg-gradient-to-r from-primary to-primary/80"
                onClick={runGestorAnalise}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Analisar agora
              </Button>
            </div>
          )}

          {gestorLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analisando produtos...</span>
            </div>
          )}

          {gestorResult && !gestorLoading && (
            <div className="space-y-3 py-2">
              {gestorResult.semCategoria === 0 && gestorResult.duplicatas === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <div className="text-3xl">✅</div>
                  <p className="text-sm font-medium">Tudo em ordem!</p>
                  <p className="text-xs text-muted-foreground">Nenhuma melhoria necessária.</p>
                </div>
              ) : (
                <>
                  {gestorResult.semCategoria > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold">Sem categoria</div>
                        <div className="text-xs text-muted-foreground">
                          {gestorResult.semCategoria} produto{gestorResult.semCategoria > 1 ? "s" : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setGestorOpen(false);
                          if (!checkPlan("business", "Classificação por IA")) return;
                          autoClassifyProducts();
                        }}
                      >
                        Classificar IA
                      </Button>
                    </div>
                  )}
                  {gestorResult.duplicatas > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold">Duplicatas</div>
                        <div className="text-xs text-muted-foreground">
                          {gestorResult.duplicatas} produto{gestorResult.duplicatas > 1 ? "s" : ""} repetido{gestorResult.duplicatas > 1 ? "s" : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setGestorOpen(false);
                          removeDuplicates();
                          setGestorBadge(prev => Math.max(0, prev - gestorResult.duplicatas));
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={runGestorAnalise}
              >
                <Loader2 className="h-3.5 w-3.5" /> Reanalisar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação Excluir Todos */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todos os produtos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente todos os {totalCount} produtos e categorias. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteAllMutation.mutate(); setDeleteAllConfirm(false); }}
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sheet de categorias */}
      <Sheet open={catSheetOpen} onOpenChange={(open) => { setCatSheetOpen(open); if (!open) setCatSearch(""); }}>
        <SheetContent side="bottom" className="h-[70vh] flex flex-col rounded-t-2xl">
          <SheetHeader className="pb-2 shrink-0">
            <SheetTitle className="text-base">Filtrar por categoria</SheetTitle>
          </SheetHeader>
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria..."
              className="pl-9"
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-1 pb-6">
              <button
                onClick={() => { setSelectedCat("Todos"); setCatSheetOpen(false); setCatSearch(""); }}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedCat === "Todos"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span>Todos os produtos</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  selectedCat === "Todos" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{totalCount}</span>
              </button>
              {categorias
                .filter(cat => !catSearch || cat.nome.toLowerCase().includes(catSearch.toLowerCase()))
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCat(cat.nome); setCatSheetOpen(false); setCatSearch(""); }}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedCat === cat.nome
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="truncate text-left flex-1 mr-2">{cat.nome}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      selectedCat === cat.nome ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>{catCounts[cat.nome] || 0}</span>
                  </button>
                ))
              }
              {categorias.filter(cat => !catSearch || cat.nome.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria encontrada</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AdicionarItemDialog
        produto={
          dialogState
            ? {
                nome: dialogState.produto.nome,
                embalagem: dialogState.produto.embalagem,
                fator: dialogState.produto.fator_embalagem,
                subtitulo: dialogState.subtitulo ?? null,
              }
            : null
        }
        origemPadrao={dialogState?.produto.fonte === "catalogo" ? "catalogo" : "cadastro"}
        badge={dialogState?.produto.fonte === "catalogo" ? "Catálogo" : null}
        onCancelar={() => setDialogState(null)}
        onConfirmar={(qtd, emb, fator) => {
          if (!dialogState) return;
          toggleCotacaoMutation.mutate({
            produto: dialogState.produto,
            adding: true,
            quantidade: qtd,
            tipoEmbalagem: emb,
            fatorEmbalagem: fator,
          });
          setDialogState(null);
        }}
      />

    </div>
  );
};

export default ProdutosPage;
