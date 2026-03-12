import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Search } from "lucide-react";

interface ItemEntry {
  nome: string;
  quantidade: number;
  embalagem: string;
}

const AppFuncionariosPublic = () => {
  const [items, setItems] = useState<ItemEntry[]>([]);
  const [current, setCurrent] = useState("");
  const [currentQtd, setCurrentQtd] = useState("1");
  const [currentEmbal, setCurrentEmbal] = useState("un");
  const [nome, setNome] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Product search from database
  const [productSearch, setProductSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [showProductList, setShowProductList] = useState(true);
  const [productQtds, setProductQtds] = useState<Record<number, string>>({});

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("nome, embalagem, categorias(nome)")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("nome").order("nome");
      if (error) throw error;
      return data as { nome: string }[];
    },
  });

  // Generic search: split terms and match all
  const filteredProducts = produtos.filter((p) => {
    const matchCat = selectedCat === "Todos" || p.categorias?.nome === selectedCat;
    if (!productSearch.trim()) return matchCat;
    const terms = productSearch.toLowerCase().trim().split(/\s+/);
    const name = p.nome.toLowerCase();
    const matchSearch = terms.every((t) => name.includes(t));
    return matchCat && matchSearch;
  });

  const addItem = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    setItems([...items, { nome: trimmed, quantidade: parseInt(currentQtd) || 1, embalagem: currentEmbal || "un" }]);
    setCurrent("");
    setCurrentQtd("1");
    setCurrentEmbal("un");
  };

  const addFromProduct = (p: any, index: number) => {
    const qty = parseInt(productQtds[index] || "1") || 1;
    setItems([...items, { nome: p.nome, quantidade: qty, embalagem: p.embalagem || "un" }]);
    setProductQtds((prev) => { const c = { ...prev }; delete c[index]; return c; });
    toast.success(`${p.nome} (${qty}x) adicionado!`);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemQtd = (index: number, val: string) => {
    setItems(items.map((item, i) => i === index ? { ...item, quantidade: parseInt(val) || 1 } : item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const enviar = async () => {
    if (!items.length) {
      toast.error("Adicione pelo menos um item!");
      return;
    }
    setSending(true);
    try {
      const inserts = items.map((item) => ({
        nome: item.nome,
        quantidade: item.quantidade,
        observacao: item.embalagem !== "un" ? `Embalagem: ${item.embalagem}` : null,
        registrado_por: nome.trim() || "Funcionário",
      }));
      const { error } = await supabase.from("itens_faltantes").insert(inserts);
      if (error) throw error;
      setSent(true);
      toast.success("Lista enviada!");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
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
          <p className="text-muted-foreground mb-4">
            {items.length} item(ns) registrado(s). O comprador irá revisar.
          </p>
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
      {/* Header */}
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white p-5 sticky top-0 z-20 shadow-lg">
        <h1 className="text-lg font-bold">📋 Lista de Itens Faltando</h1>
        <p className="text-sm opacity-80">Digite os itens ou busque no banco de produtos</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Name input */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Seu nome (opcional)
          </label>
          <Input
            placeholder="Ex: João"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        {/* Toggle: manual vs search */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={!showProductList ? "default" : "outline"}
            onClick={() => setShowProductList(false)}
            className="flex-1 text-xs"
          >
            ✏️ Digitar item
          </Button>
          <Button
            size="sm"
            variant={showProductList ? "default" : "outline"}
            onClick={() => setShowProductList(true)}
            className="flex-1 text-xs"
          >
            🔍 Buscar no banco
          </Button>
        </div>

        {!showProductList ? (
          /* Manual entry */
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                Descrição do produto
              </label>
              <Input
                placeholder="Ex: Detergente Ype 500ml"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
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
                  onChange={(e) => setCurrentQtd(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Embalagem</label>
                <select
                  value={currentEmbal}
                  onChange={(e) => setCurrentEmbal(e.target.value)}
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
          /* Product DB search */
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto... (ex: det ype)"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedCat("Todos")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCat === "Todos" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c.nome}
                  onClick={() => setSelectedCat(c.nome)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCat === c.nome ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
            <ScrollArea className="h-[250px] border rounded-lg">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Nenhum produto encontrado.</div>
              ) : (
                filteredProducts.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 border-b hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">{p.categorias?.nome || "Sem categoria"} · {p.embalagem || "un"}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        min="1"
                        value={productQtds[i] || "1"}
                        onChange={(e) => setProductQtds((prev) => ({ ...prev, [i]: e.target.value }))}
                        className="h-8 w-14 text-xs text-center"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-primary font-bold text-lg"
                        onClick={() => addFromProduct(p, i)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {/* Items list */}
        {items.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b bg-muted">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {items.length} item(ns) na lista
              </span>
            </div>
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              >
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">{item.nome}</span>
                  <span className="text-xs text-muted-foreground">{item.embalagem}</span>
                </div>
                <Input
                  type="number"
                  min="1"
                  value={item.quantidade}
                  onChange={(e) => updateItemQtd(i, e.target.value)}
                  className="h-7 w-14 text-xs text-center"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="text-destructive text-sm hover:bg-destructive/10 rounded-full w-7 h-7 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg z-10">
        <Button
          onClick={enviar}
          disabled={sending || items.length === 0}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base py-6 font-bold"
        >
          {sending ? "Enviando..." : `📤 Enviar ${items.length} Item(ns)`}
        </Button>
      </div>
    </div>
  );
};

export default AppFuncionariosPublic;
