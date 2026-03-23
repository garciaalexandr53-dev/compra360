import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Download } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Search, ClipboardList, Package, Store } from "lucide-react";
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

  // Swap manifest to funcionarios version & listen for install prompt
  useEffect(() => {
    // Inject funcionarios manifest
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
      // Restore default manifest
      const el = document.querySelector('link[rel="manifest"]');
      if (el) el.setAttribute("href", "/manifest.json");
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // Read loja from URL param (pre-defined by buyer)
  const urlLojaId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("loja") || "";
  }, []);
  const lojaFromUrl = !!urlLojaId;

  const [selectedLojaId, setSelectedLojaId] = useState<string>(urlLojaId);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(true);
  const [productQtds, setProductQtds] = useState<Record<string, string>>({});
  const productsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  // If loja comes from URL, fetch only that loja; otherwise fetch all (public page, RLS handles visibility)
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-public", urlLojaId],
    queryFn: async () => {
      if (urlLojaId) {
        const { data, error } = await supabase.from("lojas").select("id, nome").eq("id", urlLojaId);
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
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

      // If a loja is selected, find products owned by that loja's owner
      let ownerUserId: string | null = null;
      if (selectedLojaId) {
        const { data: lojaData } = await supabase.from("lojas").select("user_id").eq("id", selectedLojaId).maybeSingle();
        ownerUserId = lojaData?.user_id || null;
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
    if (!showProductList || !productsListRef.current || !hasNextPage || isFetchingNextPage || produtosLoading) {
      return;
    }

    const listElement = productsListRef.current;
    if (listElement.scrollHeight <= listElement.clientHeight + 24) {
      fetchNextPage();
    }
  }, [showProductList, filteredProducts.length, hasNextPage, isFetchingNextPage, fetchNextPage, produtosLoading]);

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
  };

  const addFromProduct = (product: ProdutoPublico) => {
    const productKey = getProductKey(product);
    const qty = parseInt(productQtds[productKey] || "1") || 1;

    setItems((prev) => [...prev, { nome: product.nome, quantidade: qty, embalagem: product.embalagem || "un" }]);
    setProductQtds((prev) => {
      const next = { ...prev };
      delete next[productKey];
      return next;
    });
    toast.success(`${product.nome} (${qty}x) adicionado!`);
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const updateItemQtd = (index: number, value: string) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantidade: parseInt(value) || 1 } : item
      )
    );
  };

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
        registrado_por: (nome.trim() || "Funcionário") + lojaLabel,
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Sonner />
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Lista Enviada!</h1>
          <p className="text-muted-foreground mb-1">{items.length} item(ns) registrado(s).</p>
          {selectedLojaName && <p className="text-sm text-primary font-medium mb-4">Loja: {selectedLojaName}</p>}
          <Button
            onClick={() => {
              setItems([]);
              setSent(false);
            }}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
          >
            Enviar outra lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Sonner />
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white p-5 sticky top-0 z-20 shadow-lg">
        <h1 className="text-lg font-bold">📋 Compra360 — Funcionários</h1>
        <p className="text-sm opacity-80">
          {activeTab === "lista" ? "Registre itens faltantes" : "Confira pedidos recebidos"}
        </p>
      </div>

      <div className="flex border-b bg-card sticky top-[76px] z-10">
        <button
          onClick={() => setActiveTab("lista")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "lista"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Itens Faltantes
        </button>
        <button
          onClick={() => setActiveTab("conferencia")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "conferencia"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Conferência
        </button>
      </div>

      {activeTab === "conferencia" ? (
        <div className="p-4">
          <ConferenciaPedidos />
        </div>
      ) : (
        <>
          <div className="p-4 space-y-4">
            {lojaFromUrl ? (
              <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedLojaName || "Loja selecionada"}</span>
              </div>
            ) : lojas.length > 1 ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                  <Store className="h-3.5 w-3.5 inline mr-1" />Loja *
                </label>
                <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map((loja) => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Seu nome (opcional)
              </label>
              <Input placeholder="Ex: João" value={nome} onChange={(event) => setNome(event.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showProductList ? "default" : "outline"}
                onClick={() => setShowProductList(true)}
                className="flex-1 text-xs"
              >
                🔍 Buscar no banco
              </Button>
              <Button
                size="sm"
                variant={!showProductList ? "default" : "outline"}
                onClick={() => setShowProductList(false)}
                className="flex-1 text-xs"
              >
                ✏️ Produto novo
              </Button>
            </div>

            {!showProductList ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Descrição do produto
                  </label>
                  <Input
                    placeholder="Ex: Detergente Ype 500ml"
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Qtd</label>
                    <Input
                      type="number"
                      min="1"
                      value={currentQtd}
                      onChange={(event) => setCurrentQtd(event.target.value)}
                      onFocus={(event) => event.target.select()}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Embalagem</label>
                    <select
                      value={currentEmbal}
                      onChange={(event) => setCurrentEmbal(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="un">un</option>
                      <option value="cx">cx</option>
                      <option value="fd">fd</option>
                      <option value="kg">kg</option>
                      <option value="lt">lt</option>
                      <option value="pc">pc</option>
                      <option value="pct">pct</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={addItem}
                      disabled={!current.trim()}
                      className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] px-6 h-10"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto... (ex: det ype)"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    className="pl-9"
                  />
                </div>

                <div
                  ref={productsListRef}
                  onScroll={handleProductsScroll}
                  className="h-[250px] overflow-y-auto border rounded-lg"
                >
                  {produtosLoading || isSearchingProducts ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">Carregando produtos...</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">Nenhum produto encontrado.</div>
                  ) : (
                    <>
                      {filteredProducts.map((product, index) => {
                        const productKey = getProductKey(product);

                        return (
                          <div
                            key={`${productKey}-${index}`}
                            className="flex items-center justify-between px-4 py-3 border-b hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{product.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                {product.categorias?.nome || "Sem categoria"} · {product.embalagem || "un"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min="1"
                                value={productQtds[productKey] || "1"}
                                onChange={(event) =>
                                  setProductQtds((prev) => ({ ...prev, [productKey]: event.target.value }))
                                }
                                onFocus={(event) => event.target.select()}
                                className="h-8 w-14 text-xs text-center"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-primary font-bold text-lg"
                                onClick={() => addFromProduct(product)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {isFetchingNextPage && (
                        <div className="px-4 py-3 text-center text-xs text-muted-foreground">Carregando mais produtos...</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b bg-muted">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {items.length} item(ns) na lista
                    {selectedLojaName && ` · ${selectedLojaName}`}
                  </span>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                    <span className="text-xs text-muted-foreground">{index + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{item.nome}</span>
                      <span className="text-xs text-muted-foreground">{item.embalagem}</span>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(event) => updateItemQtd(index, event.target.value)}
                      onFocus={(event) => event.target.select()}
                      className="h-7 w-14 text-xs text-center"
                    />
                    <button
                      onClick={() => removeItem(index)}
                      className="text-destructive text-sm hover:bg-destructive/10 rounded-full w-7 h-7 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg z-10">
            <Button
              onClick={enviar}
              disabled={sending || items.length === 0 || (lojas.length > 1 && !selectedLojaId)}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base py-6 font-bold"
            >
              {sending ? "Enviando..." : `📤 Enviar ${items.length} Item(ns)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AppFuncionariosPublic;
