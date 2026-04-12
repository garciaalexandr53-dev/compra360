import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Pencil, Trash2, Check, Upload, ChevronLeft, Sparkles, Loader2, MoreHorizontal, ArrowRight, Package, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import ImportProdutosModal from "@/components/ImportProdutosModal";
import CatalogoBaseModal from "@/components/CatalogoBaseModal";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";
import type { Tables } from "@/integrations/supabase/types";


type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };
type Categoria = Tables<"categorias">;

import { EMBALAGEM_SIGLAS, getDefaultFator } from "@/lib/embalagem";
import { autoSuggestFator } from "@/lib/autoFator";
const EMBALAGEM_OPTIONS = EMBALAGEM_SIGLAS;
const emptyForm = { nome: "", categoria_id: "", embalagem: "UNI", quantidade: 1, fator_embalagem: 1 };
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [catSidebarOpen, setCatSidebarOpen] = useState(false);
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

  // Popover states for adding to cotação
  const [popoverOpen, setPopoverOpen] = useState<Record<string, boolean>>({});
  const [popoverQtd, setPopoverQtd] = useState<Record<string, string>>({});
  const [popoverEmb, setPopoverEmb] = useState<Record<string, string>>({});
  const [popoverFator, setPopoverFator] = useState<Record<string, string>>({});

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

      if (search.trim()) {
        query = query.ilike("nome", `%${search.trim()}%`);
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
        .select("produto_id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      return data ?? [];
    },
  });

  const itensNaCotacao = useMemo(() => new Set(cotacaoItens.map(i => i.produto_id)), [cotacaoItens]);
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
    mutationFn: async ({ produtoId, adding, quantidade = 1, tipoEmbalagem = "UNI", fatorEmbalagem = 1 }: { produtoId: string; adding: boolean; quantidade?: number; tipoEmbalagem?: string; fatorEmbalagem?: number }) => {
      if (adding && cotacaoAtiva) {
        const { error } = await supabase.from("cotacao_produtos").insert({
          cotacao_id: cotacaoAtiva.id,
          produto_id: produtoId,
          quantidade,
          tipo_embalagem: tipoEmbalagem,
          fator_embalagem: fatorEmbalagem,
        } as any);
        if (error) throw error;
      } else if (!adding && cotacaoAtiva) {
        const { error } = await supabase.from("cotacao_produtos")
          .delete()
          .eq("cotacao_id", cotacaoAtiva.id)
          .eq("produto_id", produtoId);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produto-ids"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      toast.success(variables.adding ? "Produto adicionado à cotação!" : "Produto removido da cotação");
    },
    onError: (e: any) => toast.error(e.message),
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
      {/* Category sidebar - collapsible */}
      {catSidebarOpen && (
        <div className="w-56 flex-shrink-0 bg-card border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categorias</span>
            <button onClick={() => setCatSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              <button
                onClick={() => setSelectedCat("Todos")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCat === "Todos" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="truncate">Todos</span>
                <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-full">{totalCount}</span>
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.nome)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCat === cat.nome ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{cat.nome}</span>
                  <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-full">{catCounts[cat.nome] || 0}</span>
                </button>
              ))}
              <button
                onClick={() => setNewCatModalOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-muted transition-colors mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Categoria
              </button>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-3 border-b bg-card/80 space-y-2">
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
                  <DropdownMenuItem onClick={() => {
                    if (!checkPlan("pro", "Sugestão de fatores por IA")) return;
                    autoSuggestFatorProducts();
                  }} disabled={produtos.length === 0}>
                    <Sparkles className="h-4 w-4 mr-2" /> Sugerir Fatores IA
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

          {/* Search com X para limpar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {filtered.length}/{totalCount}
            </span>
          </div>

          {/* Chips de categoria — scroll horizontal */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-3 px-3">
            <button
              onClick={() => setSelectedCat("Todos")}
              className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                selectedCat === "Todos"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              Todos ({totalCount})
            </button>
            {categorias.slice(0, 10).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.nome)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                  selectedCat === cat.nome
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {cat.nome} ({catCounts[cat.nome] || 0})
              </button>
            ))}
            {categorias.length > 10 && (
              <button
                onClick={() => setCatSidebarOpen(true)}
                className="shrink-0 text-xs px-3 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/40 transition-colors whitespace-nowrap"
              >
                +{categorias.length - 10} mais
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto ${cotacaoItemCount > 0 ? "pb-24" : ""}`}>
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            <>
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, prods]) => (
                <div key={cat}>
                  {selectedCat === "Todos" && (
                    <div className="px-4 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10 border-b">
                      {cat}
                    </div>
                  )}
                  {prods.map((p) => {
                    const inCotacao = itensNaCotacao.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 px-3 py-2.5 border-b hover:bg-muted/30 transition-all ${
                          inCotacao ? "border-l-2 border-l-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.categorias?.nome || "Sem Categoria"} · {p.embalagem || "un"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} title="Editar">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setDeleteConfirmId(p.id); setDeleteConfirmName(p.nome); }}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                          {inCotacao ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 transition-all bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                              onClick={() => toggleCotacaoMutation.mutate({ produtoId: p.id, adding: false })}
                            >
                              ✓
                            </Button>
                          ) : (
                            <Popover
                              open={popoverOpen[p.id] || false}
                              onOpenChange={(open) => {
                                setPopoverOpen(prev => ({ ...prev, [p.id]: open }));
                                if (open) {
                                  const embType = p.embalagem?.split("|")[0]?.trim()?.toUpperCase() || "UNI";
                                  const tipos = ["UNI", "CX", "DZ", "FD", "KG", "PCT"];
                                  const matched = tipos.find(t => embType.startsWith(t)) || "UNI";
                                  setPopoverQtd(prev => ({ ...prev, [p.id]: "" }));
                                  setPopoverEmb(prev => ({ ...prev, [p.id]: matched }));
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white"
                                >
                                  +
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3" align="end">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-semibold truncate">{p.nome}</p>
                                    <p className="text-xs text-muted-foreground">{p.categorias?.nome || "Sem Categoria"} · {p.embalagem || "un"}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Quantidade</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="Ex: 10"
                                      value={popoverQtd[p.id] || ""}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        setPopoverQtd(prev => ({ ...prev, [p.id]: val }));
                                      }}
                                      className="h-10 text-center font-bold text-base"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Embalagem</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {["UNI", "CX", "DZ", "½DZ", "FD", "KG", "PCT"].map(emb => (
                                        <button
                                          key={emb}
                                          type="button"
                                          onClick={() => {
                                            setPopoverEmb(prev => ({ ...prev, [p.id]: emb }));
                                            setPopoverFator(prev => ({ ...prev, [p.id]: String(getDefaultFator(emb)) }));
                                          }}
                                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                            (popoverEmb[p.id] || "UNI") === emb
                                              ? "bg-primary text-primary-foreground border-primary"
                                              : "border-border text-muted-foreground hover:border-primary/50"
                                          }`}
                                        >
                                          {emb}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Fator (un/embalagem)</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={popoverFator[p.id] ?? "1"}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => setPopoverFator(prev => ({ ...prev, [p.id]: e.target.value.replace(/\D/g, "") }))}
                                      onBlur={() => setPopoverFator(prev => ({ ...prev, [p.id]: !prev[p.id] || prev[p.id] === "0" ? "1" : prev[p.id] }))}
                                      className="h-8 text-center text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => setPopoverOpen(prev => ({ ...prev, [p.id]: false }))}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => {
                                        const qtd = parseInt(popoverQtd[p.id] || "0");
                                        if (!qtd || qtd < 1) {
                                          toast.error("Informe a quantidade (mínimo 1)");
                                          return;
                                        }
                                        toggleCotacaoMutation.mutate({
                                          produtoId: p.id,
                                          adding: true,
                                          quantidade: qtd,
                                          tipoEmbalagem: popoverEmb[p.id] || "UNI",
                                          fatorEmbalagem: parseInt(popoverFator[p.id] || "1") || 1,
                                        });
                                        setPopoverOpen(prev => ({ ...prev, [p.id]: false }));
                                      }}
                                    >
                                      ✅ Adicionar
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
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
                {classifyStatus === "running" && <>{classifyMode === "classify" ? <Sparkles className="h-5 w-5 text-primary animate-pulse" /> : <Package className="h-5 w-5 text-primary animate-pulse" />} {classifyMode === "classify" ? "Classificando produtos..." : "Analisando embalagens..."}</>}
                {classifyStatus === "done" && <><span className="text-xl">✅</span> {classifyMode === "classify" ? "Classificação concluída!" : "Fatores atualizados!"}</>}
                {classifyStatus === "error" && <><span className="text-xl">❌</span> {classifyMode === "classify" ? "Erro na classificação" : "Erro na análise"}</>}
              </DialogTitle>
              <DialogDescription>
                {classifyStatus === "running" && (classifyMode === "classify"
                  ? `Analisando ${produtos.filter(p => !p.categoria_id).length || filtered.length} produtos · Aguarde`
                  : `Sugerindo fatores para ${produtos.filter(p => (p.fator_embalagem || 1) === 1).length || filtered.length} produtos · Aguarde`)}
                {classifyStatus === "done" && (classifyMode === "classify"
                  ? `${classifyResult.updated} produtos classificados em ${classifyResult.categories} categorias`
                  : `${classifyResult.updated} produtos atualizados com novo fator de embalagem`)}
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
                <Button onClick={classifyMode === "classify" ? autoClassifyProducts : autoSuggestFatorProducts}>Tentar Novamente</Button>
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
                    setForm({ ...form, embalagem: emb, fator_embalagem: getDefaultFator(emb) });
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
          <DialogFooter>
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
    </div>
  );
};

export default ProdutosPage;
