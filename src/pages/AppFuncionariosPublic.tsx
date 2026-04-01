import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Download, Check } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Search, ClipboardList, Package, Store, MapPin, Plus, Minus, Send } from "lucide-react";
import ConferenciaPedidos from "@/components/ConferenciaPedidos";

interface ItemEntry {
  nome: string;
  quantidade: number;
  embalagem: string;
}

interface ProdutoPublico {
  nome: string;
  embalagem: string | null;
  categorias: {
    nome: string;
  } | null;
}

type AppTab = "lista" | "conferencia";

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
  const [sent, setSent] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [showNewProduct, setShowNewProduct] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Swap manifest to funcionarios version & listen for install prompt
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) existing.setAttribute("href", "/manifest-funcionarios.json");
    else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest-funcionarios.json";
      document.head.appendChild(link);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      const el = document.querySelector('link[rel="manifest"]');
      if (el) el.setAttribute("href", "/manifest.json");
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // Auto-focus search on mount
  useEffect(() => {
    if (activeTab === "lista") {
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [activeTab]);

  const urlLojaId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("loja") || "";
  }, []);
  const lojaFromUrl = !!urlLojaId;

  const [selectedLojaId, setSelectedLojaId] = useState<string>(urlLojaId);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [productQtds, setProductQtds] = useState<Record<string, number>>({});
  const productsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-public", urlLojaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lojas_public", {
        _loja_id: urlLojaId || undefined,
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
      const from = pageParam * PRODUCT_PAGE_SIZE;
      const to = from + PRODUCT_PAGE_SIZE - 1;
      const searchTerms = debouncedProductSearch.toLowerCase().split(/\s+/).filter(Boolean);

      let ownerUserId: string | null = null;
      if (selectedLojaId) {
        const { data: ownerId } = await supabase.rpc("get_loja_owner", { _loja_id: selectedLojaId });
        ownerUserId = ownerId || null;
      }

      let query = supabase
        .from("produtos")
        .select("nome, embalagem, categorias(nome)", { count: "exact" })
        .eq("ativo", true)
        .order("nome")
        .range(from, to);

      if (ownerUserId) {
        query = query.eq("user_id", ownerUserId);
      }

      if (searchTerms.length > 0) {
        query = query.ilike("nome", `%${searchTerms[0]}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const products = ((data || []) as ProdutoPublico[]).filter((product) => {
        if (searchTerms.length === 0) return true;
        const productName = product.nome.toLowerCase();
        return searchTerms.every((term) => productName.includes(term));
      });

      const nextOffset = from + (data?.length || 0);
      return {
        products,
        nextPage: count !== null && nextOffset < count ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const filteredProducts = useMemo(
    () => produtosData?.pages.flatMap((page) => page.products) ?? [],
    [produtosData]
  );

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
      { nome: trimmed, quantidade: parseInt(currentQtd) || 1, embalagem: currentEmbal || "un" },
    ]);
    setCurrent("");
    setCurrentQtd("1");
    setCurrentEmbal("un");
    setShowNewProduct(false);
    toast.success("Adicionado!");
  };

  const addFromProduct = useCallback((product: ProdutoPublico) => {
    const productKey = getProductKey(product);
    const qty = productQtds[productKey] || 1;

    setItems((prev) => [...prev, { nome: product.nome, quantidade: qty, embalagem: product.embalagem || "un" }]);
    setProductQtds((prev) => {
      const next = { ...prev };
      delete next[productKey];
      return next;
    });

    // Visual feedback
    setJustAdded((prev) => new Set(prev).add(productKey));
    setTimeout(() => {
      setJustAdded((prev) => {
        const next = new Set(prev);
        next.delete(productKey);
        return next;
      });
    }, 1200);
  }, [productQtds]);

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const updateProductQtd = useCallback((productKey: string, delta: number) => {
    setProductQtds((prev) => {
      const current = prev[productKey] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productKey]: next };
    });
  }, []);

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
      const inserts = items.map((item) => ({
        nome: item.nome,
        quantidade: item.quantidade,
        observacao: [
          item.embalagem !== "un" ? `Embalagem: ${item.embalagem}` : null,
          lojaLabel || null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
        registrado_por: "Funcionário" + lojaLabel,
        loja_id: selectedLojaId || (lojas.length === 1 ? lojas[0].id : null),
      }));

      const { error } = await supabase.from("itens_faltantes").insert(inserts as never);
      if (error) throw error;

      setSent(true);
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
              <h1 className="text-base font-bold leading-tight">Compra360</h1>
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
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {items.length}
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
      </div>

      {activeTab === "conferencia" ? (
        <div className="p-4 flex-1">
          <ConferenciaPedidos />
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Loja indicator or selector */}
          {lojaFromUrl && selectedLojaName ? (
            <div className="px-4 pt-3">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Loja: <span className="font-medium text-foreground">{selectedLojaName}</span>
              </p>
            </div>
          ) : !lojaFromUrl && lojas.length > 1 ? (
            <div className="px-4 pt-3">
              <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
                <SelectTrigger className="h-11">
                  <Store className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}


          {/* Search bar - always visible */}
          <div className="px-4 pt-3 pb-2 sticky top-[92px] z-10 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 h-12 text-base rounded-xl border-2 focus-visible:ring-primary"
              />
            </div>
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
                  const qty = productQtds[productKey] || 1;

                  return (
                    <div
                      key={`${productKey}-${index}`}
                      className={`flex items-center gap-2 mx-1 my-1 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                        isAdded
                          ? "bg-green-500/10 border-green-500/40 scale-[0.98]"
                          : "bg-card border-border hover:border-primary/30 active:scale-[0.98]"
                      }`}
                    >
                      {/* Product info */}
                      <div className="flex-1 min-w-0" onClick={() => addFromProduct(product)}>
                        <div className="text-sm font-medium leading-tight truncate">{product.nome}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {product.embalagem || "un"}
                          {product.categorias?.nome ? ` · ${product.categorias.nome}` : ""}
                        </div>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => updateProductQtd(productKey, -1)}
                          className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">{qty}</span>
                        <button
                          onClick={() => updateProductQtd(productKey, 1)}
                          className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Add button */}
                      <button
                        onClick={() => addFromProduct(product)}
                        className={`h-10 px-3 rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-90 ${
                          isAdded
                            ? "bg-green-500 text-white"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span className="text-xs font-semibold">OK</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-semibold">Add</span>
                          </>
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
            <div className="sticky bottom-0 left-0 right-0 bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-10">
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

          {/* FAB for new product when no results */}
          {!showNewProduct && items.length === 0 && filteredProducts.length > 0 && (
            <div className="sticky bottom-4 flex justify-center pb-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-10 gap-2 shadow-md"
                onClick={() => setShowNewProduct(true)}
              >
                <Plus className="h-4 w-4" /> Produto não listado
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppFuncionariosPublic;
