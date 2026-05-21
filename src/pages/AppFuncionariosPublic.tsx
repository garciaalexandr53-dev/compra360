import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Download, Check, X, History } from "lucide-react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Search, ClipboardList, Package, Store, MapPin, Plus, Minus, Send } from "lucide-react";
import ConferenciaPedidos from "@/components/ConferenciaPedidos";
import { FATOR_PADRAO } from "@/lib/embalagemFatores";
import AdicionarItemDialog from "@/components/shared/AdicionarItemDialog";

interface ItemEntry {
  nome: string;
  quantidade: number;
  embalagem: string;
  fator: number;
}

interface ProdutoPublico {
  nome: string;
  embalagem: string | null;
  fator_embalagem: number;
  categorias: {
    nome: string;
  } | null;
}

type AppTab = "lista" | "conferencia" | "enviados";

const PRODUCT_PAGE_SIZE = 80;
const SEARCH_DEBOUNCE_MS = 250;

const getProductKey = (product: ProdutoPublico) => `${product.nome}::${product.embalagem || "un"}`;

const AppFuncionariosPublic = () => {
  const [activeTab, setActiveTab] = useState<AppTab>("lista");
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [current, setCurrent] = useState("");
  const [currentQtd, setCurrentQtd] = useState("1");
  const [currentEmbal, setCurrentEmbal] = useState("un");
  const [nome, setNome] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [dialogProduct, setDialogProduct] = useState<ProdutoPublico | null>(null);
  const [dialogQtd, setDialogQtd] = useState("1");
  const [dialogEmbal, setDialogEmbal] = useState("UNI");
  const [dialogFator, setDialogFator] = useState("1");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep title consistent and capture install prompt
  useEffect(() => {
    const originalTitle = document.title;
    const originalManifest = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "/manifest.json";
    const originalAppleTitle =
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content") || "Compra360";

    document.title = "Compra360 Reposição";

    const search = new URLSearchParams(window.location.search);
    const tokenFromSearch = search.get("__lovable_token");
    const tokenFromHref = window.location.href.match(/[?&]__lovable_token=([^&#]+)/)?.[1] || null;
    const token = tokenFromSearch || (tokenFromHref ? decodeURIComponent(tokenFromHref) : null);
    const manifestHref = token
      ? `/manifest-funcionarios.json?__lovable_token=${encodeURIComponent(token)}`
      : "/manifest-funcionarios.json";

    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.setAttribute("href", manifestHref);

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute("content", "Compra360 Reposição");

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      document.title = originalTitle;
      const manifestOnCleanup = document.querySelector('link[rel="manifest"]');
      if (manifestOnCleanup) manifestOnCleanup.setAttribute("href", originalManifest);
      const appleTitleOnCleanup = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitleOnCleanup) appleTitleOnCleanup.setAttribute("content", originalAppleTitle);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // Auto-focus search on mount
  useEffect(() => {
    if (activeTab === "lista") {
      // Use requestAnimationFrame for faster focus
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [activeTab]);

  const urlLojaId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("loja") || "";
  }, []);
  const lojaFromUrl = !!urlLojaId;

  const [selectedLojaId, setSelectedLojaId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const lojaFromLink = new URLSearchParams(window.location.search).get("loja") || "";
    const lojaPersistida = window.localStorage.getItem("funcionarios_loja_id") || "";
    return lojaFromLink || lojaPersistida;
  });
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  
  const productsListRef = useRef<HTMLDivElement | null>(null);
  const itemsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (urlLojaId && urlLojaId !== selectedLojaId) {
      setSelectedLojaId(urlLojaId);
    }
  }, [urlLojaId, selectedLojaId]);

  useEffect(() => {
    if (!selectedLojaId) return;

    window.localStorage.setItem("funcionarios_loja_id", selectedLojaId);

    const params = new URLSearchParams(window.location.search);
    if (!params.get("loja")) {
      params.set("loja", selectedLojaId);
      const nextSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }
  }, [selectedLojaId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-public", selectedLojaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lojas_public", {
        _loja_id: selectedLojaId || undefined,
      });
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const {
    data: produtosData,
    isLoading: produtosLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["produtos-public", debouncedProductSearch, selectedLojaId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = pageParam * PRODUCT_PAGE_SIZE;
      const searchTerms = debouncedProductSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const searchParam = searchTerms.length > 0 ? searchTerms[0] : null;

      if (!selectedLojaId) {
        return { products: [] as ProdutoPublico[], nextPage: undefined };
      }

      const { data, error } = await supabase.rpc("get_produtos_for_loja", {
        _loja_id: selectedLojaId,
        _search: searchParam,
        _limit: PRODUCT_PAGE_SIZE,
        _offset: offset,
      });

      if (error) throw error;

      const totalCount = (data && data.length > 0) ? Number((data[0] as any).total_count) : 0;

      const products: ProdutoPublico[] = ((data || []) as any[]).map((row) => ({
        nome: row.nome,
        embalagem: row.embalagem,
        fator_embalagem: row.fator_embalagem,
        categorias: row.categoria_nome ? { nome: row.categoria_nome } : null,
      }));

      // Client-side multi-term filter (RPC only filters first term)
      const filtered = products.filter((product) => {
        if (searchTerms.length <= 1) return true;
        const productName = product.nome.toLowerCase();
        return searchTerms.every((term) => productName.includes(term));
      });

      const nextOffset = offset + products.length;
      return {
        products: filtered,
        nextPage: nextOffset < totalCount ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const filteredProducts = useMemo(
    () => produtosData?.pages.flatMap((page) => page.products) ?? [],
    [produtosData]
  );

  // Query for sent items history (last 30 days)
  const thirtyDaysAgo = useMemo(() => subDays(new Date(), 30).toISOString(), []);
  const { data: enviados = [], isLoading: enviadosLoading } = useQuery({
    queryKey: ["itens-enviados", selectedLojaId],
    enabled: !!selectedLojaId && activeTab === "enviados",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_faltantes")
        .select("id, nome, quantidade, observacao, registrado_por, created_at, importado")
        .eq("loja_id", selectedLojaId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const enviadosGrouped = useMemo(() => {
    const groups: Record<string, typeof enviados> = {};
    for (const item of enviados) {
      const date = new Date(item.created_at);
      let label: string;
      if (isToday(date)) label = "Hoje";
      else if (isYesterday(date)) label = "Ontem";
      else label = format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR });
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return Object.entries(groups);
  }, [enviados]);

  useEffect(() => {
    if (!productsListRef.current || !hasNextPage || isFetchingNextPage || produtosLoading) return;
    const listElement = productsListRef.current;
    if (listElement.scrollHeight <= listElement.clientHeight + 24) {
      fetchNextPage();
    }
  }, [filteredProducts.length, hasNextPage, isFetchingNextPage, fetchNextPage, produtosLoading]);

  const addItem = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      { nome: trimmed, quantidade: parseInt(currentQtd) || 1, embalagem: currentEmbal || "un", fator: 1 },
    ]);
    setCurrent("");
    setCurrentQtd("1");
    setCurrentEmbal("un");
    setShowNewProduct(false);
    toast.success("Adicionado!");
  };

  const openProductDialog = useCallback((product: ProdutoPublico) => {
    const embRaw = (product.embalagem || "UNI").split("|")[0]?.trim().toUpperCase() || "UNI";
    const tipos = ["UNI", "CX", "DZ", "½DZ", "DP", "FD", "KG", "PCT"];
    const matched = tipos.find((t) => embRaw.startsWith(t)) || "UNI";
    const fatorPadrao = FATOR_PADRAO[matched] ?? 1;
    const fatorCadastrado =
      product.fator_embalagem && product.fator_embalagem > 0
        ? product.fator_embalagem
        : fatorPadrao;
    setDialogProduct(product);
    setDialogQtd("1");
    setDialogEmbal(matched);
    // Garantir fator sempre válido, nunca vazio
    const finalFator = fatorCadastrado && fatorCadastrado > 0 ? fatorCadastrado : fatorPadrao;
    setDialogFator(String(finalFator));
  }, []);

  const confirmProductDialog = useCallback(() => {
    if (!dialogProduct) return;
    const productKey = getProductKey(dialogProduct);
    const qty = parseInt(dialogQtd) || 1;
    // Garantir fator válido: se vazio/zero, usar padrão da embalagem
    let fator = parseInt(dialogFator);
    if (!fator || fator <= 0) {
      fator = FATOR_PADRAO[dialogEmbal] ?? 1;
    }

    const embLabel = dialogEmbal.toLowerCase();
    const obsParts: string[] = [];
    if (embLabel !== "uni") obsParts.push(`Embalagem: ${dialogEmbal}`);
    if (fator > 1) obsParts.push(`${fator}un por ${dialogEmbal}`);

    setItems((prev) => [...prev, {
      nome: dialogProduct.nome,
      quantidade: qty,
      embalagem: embLabel,
      fator,
    }]);

    setProductSearch("");
    setTimeout(() => searchInputRef.current?.focus(), 100);

    const totalUn = fator > 1 ? ` (${qty * fator}un)` : "";
    toast.success(`✅ ${dialogProduct.nome} — ${qty} ${dialogEmbal}${totalUn}`, { duration: 1500, position: "top-center" });

    setJustAdded((prev) => new Set(prev).add(productKey));
    setTimeout(() => {
      setJustAdded((prev) => {
        const next = new Set(prev);
        next.delete(productKey);
        return next;
      });
    }, 2000);

    setDialogProduct(null);
  }, [dialogProduct, dialogQtd, dialogEmbal, dialogFator]);

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));


  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  const handleProductsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const listElement = event.currentTarget;
    const distanceFromBottom = listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight;
    if (distanceFromBottom < 120 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const selectedLojaName = lojas.find((loja) => loja.id === selectedLojaId)?.nome || "";
  const isSearchingProducts = productSearch.trim() !== debouncedProductSearch;

  const enviar = async () => {
    if (!items.length) {
      toast.error("Adicione pelo menos um item!");
      return;
    }
    if (!lojaFromUrl && lojas.length > 1 && !selectedLojaId) {
      toast.error("Selecione a loja!");
      return;
    }

    setSending(true);
    try {
      const lojaLabel = selectedLojaName ? ` [${selectedLojaName}]` : "";
      const inserts = items.map((item) => {
        const fator = item.fator || 1;
        const obsParts: string[] = [];
        if (item.embalagem !== "un") obsParts.push(`Embalagem: ${item.embalagem}`);
        if (fator > 1) obsParts.push(`Fator: ${fator}`);
        if (lojaLabel) obsParts.push(lojaLabel.trim());
        return {
          nome: item.nome,
          quantidade: item.quantidade,
          observacao: obsParts.length ? obsParts.join(" | ") : null,
          registrado_por: "Funcionário" + lojaLabel,
          loja_id: selectedLojaId || (lojas.length === 1 ? lojas[0].id : null),
        };
      });

      const { error } = await supabase.from("itens_faltantes").insert(inserts as never);
      if (error) throw error;

      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["itens-enviados", selectedLojaId] });
      const lojaMsg = selectedLojaName ? ` para ${selectedLojaName}` : "";
      toast.success(`${items.length} itens enviados${lojaMsg}!`);
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Sonner />
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Lista Enviada!</h1>
          <p className="text-muted-foreground mb-1">{items.length} item(ns) registrado(s).</p>
          {selectedLojaName && <p className="text-sm text-primary font-medium mb-4">Loja: {selectedLojaName}</p>}
          <Button
            onClick={() => {
              setItems([]);
              setSent(false);
              setTimeout(() => searchInputRef.current?.focus(), 300);
            }}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] h-12 px-8 text-base"
          >
            Enviar outra lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <Sonner />

      {/* Compact sticky header */}
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white px-4 py-3 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <h1 className="text-base font-bold leading-tight">Compra360 Reposição</h1>
              {selectedLojaName && (
                <p className="text-[11px] opacity-80 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedLojaName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                📋 {items.length} {items.length === 1 ? "item" : "itens"}
              </span>
            )}
            {installPrompt && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1 text-xs h-8"
                onClick={async () => {
                  installPrompt.prompt();
                  const { outcome } = await installPrompt.userChoice;
                  if (outcome === "accepted") setInstallPrompt(null);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Instalar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-card sticky top-[52px] z-10">
        <button
          onClick={() => setActiveTab("lista")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "lista"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Itens Faltantes
        </button>
        <button
          onClick={() => setActiveTab("conferencia")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "conferencia"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Conferência
        </button>
        <button
          onClick={() => setActiveTab("enviados")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "enviados"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Enviados
        </button>
      </div>

      {/* Items counter badge */}
      {activeTab === "lista" && items.length > 0 && (
        <div className="px-4 py-1.5 bg-primary/5 border-b flex items-center justify-between">
          <span className="text-xs font-medium text-primary flex items-center gap-1.5">
            📋 {items.length} {items.length === 1 ? "item" : "itens"} na lista
          </span>
          <button
            onClick={() => itemsListRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver lista ↓
          </button>
        </div>
      )}

      {activeTab === "conferencia" ? (
        <div className="p-4 flex-1">
          <ConferenciaPedidos />
        </div>
      ) : activeTab === "enviados" ? (
        <div className="flex-1 overflow-y-auto p-4">
          {enviadosLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : enviados.length === 0 ? (
            <div className="p-8 text-center">
              <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum item enviado nos últimos 30 dias</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{enviados.length} item(ns) nos últimos 30 dias</p>
              {enviadosGrouped.map(([dateLabel, groupItems]) => (
                <div key={dateLabel}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                    {dateLabel} ({groupItems.length})
                  </h3>
                  <div className="space-y-1">
                    {groupItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                          item.importado
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-card border-border"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.nome}</span>
                          {item.quantidade && (
                            <span className="text-muted-foreground ml-1.5 text-xs">×{item.quantidade}</span>
                          )}
                        </div>
                        {item.importado && (
                          <span className="text-[10px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                            Importado
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(item.created_at), "HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Loja indicator (fixed label only) */}
          {selectedLojaName && (
            <div className="px-4 pt-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Loja: <span className="font-medium text-foreground">{selectedLojaName}</span>
              </p>
            </div>
          )}


          {/* Search bar + "não listado" button - always visible */}
          <div className="px-4 pt-3 pb-2 sticky top-[92px] z-10 bg-background space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 pr-9 h-12 text-base rounded-xl border-2 focus-visible:ring-primary"
                autoFocus
              />
              {productSearch.length > 0 && (
                <button
                  onClick={() => {
                    setProductSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {!showNewProduct && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 gap-2 border-green-500/50 text-green-600 hover:bg-green-500/5 font-medium"
                onClick={() => {
                  setCurrent(productSearch.trim());
                  setShowNewProduct(true);
                }}
              >
                <Plus className="h-4 w-4" /> Produto não listado
              </Button>
            )}
          </div>

          {/* Product list */}
          <div
            ref={productsListRef}
            onScroll={handleProductsScroll}
            className="flex-1 overflow-y-auto px-2"
            style={{ maxHeight: items.length > 0 ? "calc(100dvh - 300px)" : "calc(100dvh - 240px)" }}
          >
            {produtosLoading || isSearchingProducts ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground text-sm mb-3">Nenhum produto encontrado</p>
                {productSearch.trim() && !showNewProduct && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 gap-2"
                    onClick={() => {
                      setCurrent(productSearch.trim());
                      setShowNewProduct(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar "{productSearch.trim()}"
                  </Button>
                )}
              </div>
            ) : (
              <>
                {filteredProducts.map((product, index) => {
                  const productKey = getProductKey(product);
                  const isAdded = justAdded.has(productKey);

                  return (
                    <div
                      key={`${productKey}-${index}`}
                      className={`flex items-center gap-2 mx-1 my-1 px-3 py-2.5 rounded-xl border transition-all duration-500 ${
                        isAdded
                          ? "bg-green-500/10 border-green-500/40"
                          : "bg-card border-border hover:border-primary/30 active:scale-[0.98]"
                      }`}
                    >
                      {/* Product info */}
                      <div className="flex-1 min-w-0" onClick={() => openProductDialog(product)}>
                        <div className="flex items-center gap-1.5">
                          {isAdded && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                          <span className="text-sm font-medium leading-snug">{product.nome}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {(product.embalagem || "un").toUpperCase()}
                          {product.fator_embalagem > 1 ? ` · ${product.fator_embalagem} un` : ""}
                          {product.categorias?.nome ? ` · ${product.categorias.nome}` : ""}
                        </div>
                      </div>

                      {/* Add button */}
                      <button
                        onClick={() => openProductDialog(product)}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                          isAdded
                            ? "bg-green-500 text-white"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {isAdded ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}

                {isFetchingNextPage && (
                  <div className="px-4 py-3 text-center text-xs text-muted-foreground">Carregando mais...</div>
                )}
              </>
            )}
          </div>

          {/* New product inline form */}
          {showNewProduct && (
            <div className="px-4 py-3 bg-card border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto novo</span>
                <button onClick={() => setShowNewProduct(false)} className="text-xs text-muted-foreground">✕</button>
              </div>
              <Input
                placeholder="Nome do produto"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11"
                autoFocus
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={currentQtd}
                  onChange={(e) => setCurrentQtd(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Qtd"
                  className="h-10 w-20"
                />
                <select
                  value={currentEmbal}
                  onChange={(e) => setCurrentEmbal(e.target.value)}
                  className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="un">un</option>
                  <option value="cx">cx</option>
                  <option value="fd">fd</option>
                  <option value="kg">kg</option>
                  <option value="lt">lt</option>
                  <option value="pc">pc</option>
                  <option value="pct">pct</option>
                </select>
                <Button
                  onClick={addItem}
                  disabled={!current.trim()}
                  className="flex-1 h-10 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          )}

          {/* Bottom bar: items summary + send */}
          {items.length > 0 && (
            <div ref={itemsListRef} className="sticky bottom-0 left-0 right-0 bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-10">
              {/* Compact items list */}
              <div className="max-h-[120px] overflow-y-auto px-3 py-2 space-y-1">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate flex-1">{item.nome}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{item.quantidade}x {item.embalagem}</span>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-destructive text-xs w-6 h-6 flex items-center justify-center rounded-full hover:bg-destructive/10 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Send button */}
              <div className="px-3 pb-3 pt-1">
                <Button
                  onClick={enviar}
                  disabled={sending || (lojas.length > 1 && !selectedLojaId)}
                  className="w-full h-14 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base font-bold rounded-xl gap-2 active:scale-[0.98] transition-transform"
                >
                  <Send className="h-5 w-5" />
                  {sending ? "Enviando..." : `Enviar ${items.length} item(ns)`}
                </Button>
              </div>
            </div>
          )}

          {/* "Produto não listado" button removed from here — now in search bar area */}
        </div>
      )}

      {/* Diálogo unificado de adicionar item */}
      <AdicionarItemDialog
        produto={
          dialogProduct
            ? {
                nome: dialogProduct.nome,
                embalagem: dialogProduct.embalagem,
                fator: dialogProduct.fator_embalagem,
                subtitulo: dialogProduct.categorias?.nome ?? null,
              }
            : null
        }
        onCancelar={() => setDialogProduct(null)}
        onConfirmar={(qty, emb, fator) => {
          if (!dialogProduct) return;
          const productKey = getProductKey(dialogProduct);
          setItems((prev) => [
            ...prev,
            { nome: dialogProduct.nome, quantidade: qty, embalagem: emb.toLowerCase(), fator },
          ]);
          setProductSearch("");
          setTimeout(() => searchInputRef.current?.focus(), 100);
          const totalUn = fator > 1 ? ` (${qty * fator}un)` : "";
          toast.success(`✅ ${dialogProduct.nome} — ${qty} ${emb}${totalUn}`, {
            duration: 1500,
            position: "top-center",
          });
          setJustAdded((prev) => new Set(prev).add(productKey));
          setTimeout(() => {
            setJustAdded((prev) => {
              const next = new Set(prev);
              next.delete(productKey);
              return next;
            });
          }, 2000);
          setDialogProduct(null);
        }}
      />
    </div>
  );
};

export default AppFuncionariosPublic;
