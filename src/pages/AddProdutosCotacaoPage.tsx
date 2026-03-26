import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Minus, Trash2, ArrowRight, ShoppingCart, Package, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LocalItem {
  id: string;
  nome: string;
  quantidade: number;
  produtoId?: string; // if matched to existing produto
}

let localIdCounter = 0;
const genId = () => `local-${++localIdCounter}`;

const AddProdutosCotacaoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();

  const [items, setItems] = useState<LocalItem[]>([]);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search term
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(nome.trim()), 250);
    return () => clearTimeout(timer);
  }, [nome]);

  // Fetch produtos matching search term (server-side filter)
  const { data: existingProdutos = [] } = useQuery({
    queryKey: ["produtos-search", debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];
      const { data } = await supabase
        .from("produtos")
        .select("id, nome")
        .eq("ativo", true)
        .ilike("nome", `%${debouncedSearch}%`)
        .order("nome")
        .limit(20);
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  // Fetch active cotacao
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
  });

  // Fetch already added products to this cotacao
  const { data: alreadyInCotacao = [] } = useQuery({
    queryKey: ["cotacao-produtos-ids", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("cotacao_produtos")
        .select("produto_id, quantidade")
        .eq("cotacao_id", cotacaoAtiva!.id);
      return data || [];
    },
  });

  const alreadyCount = alreadyInCotacao.length;

  const handleAdd = () => {
    const trimmed = nome.trim();
    if (!trimmed) return;

    // Check duplicate in local list
    if (items.some(i => i.nome.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Produto já adicionado à lista");
      return;
    }

    // Try to match existing produto
    const match = existingProdutos.find(p => p.nome.toLowerCase() === trimmed.toLowerCase());

    setItems(prev => [...prev, {
      id: genId(),
      nome: trimmed,
      quantidade: Math.max(1, quantidade),
      produtoId: match?.id,
    }]);

    setNome("");
    setQuantidade(1);
    inputRef.current?.focus();
    toast.success("Produto adicionado ✔", { duration: 1500 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleContinue = async () => {
    if (items.length === 0) return;
    setSaving(true);

    try {
      let cotacaoId = cotacaoAtiva?.id;

      // Create cotacao if none exists
      if (!cotacaoId) {
        const nome = `Cotação ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
        const { data: newCot, error } = await supabase.from("cotacoes").insert({
          nome,
          loja_id: lojaAtiva?.id || null,
          created_by: user?.id,
        }).select().single();
        if (error) throw error;
        cotacaoId = newCot.id;
      }

      // For each item: create produto if not matched, then add to cotacao_produtos
      const toInsert: { cotacao_id: string; produto_id: string; quantidade: number }[] = [];

      for (const item of items) {
        let produtoId = item.produtoId;

        if (!produtoId) {
          // Create new produto
          const { data: newProd, error } = await supabase.from("produtos").insert({
            nome: item.nome,
            user_id: user?.id,
          }).select("id").single();
          if (error) throw error;
          produtoId = newProd.id;
        }

        // Check if already in cotacao
        const alreadyExists = alreadyInCotacao.some(a => a.produto_id === produtoId);
        if (!alreadyExists) {
          toInsert.push({
            cotacao_id: cotacaoId!,
            produto_id: produtoId!,
            quantidade: item.quantidade,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("cotacao_produtos").insert(toInsert);
        if (error) throw error;
      }

      queryClient.invalidateQueries();
      toast.success(`${toInsert.length} produto(s) adicionado(s) à cotação!`);
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar produtos");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = items.length + alreadyCount;

  // Suggestions from existing products
  const suggestions = useMemo(() => {
    if (nome.trim().length < 2) return [];
    const term = nome.toLowerCase();
    const localNames = new Set(items.map(i => i.nome.toLowerCase()));
    return existingProdutos
      .filter(p => p.nome.toLowerCase().includes(term) && !localNames.has(p.nome.toLowerCase()))
      .slice(0, 5);
  }, [nome, existingProdutos, items]);

  const pickSuggestion = (p: { id: string; nome: string }) => {
    setItems(prev => [...prev, { id: genId(), nome: p.nome, quantidade: Math.max(1, quantidade), produtoId: p.id }]);
    setNome("");
    setQuantidade(1);
    inputRef.current?.focus();
    toast.success("Produto adicionado ✔", { duration: 1500 });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 pb-2 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Adicionar produtos</h1>
            <p className="text-xs text-muted-foreground">Monte sua lista para cotação</p>
          </div>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="default" className="text-[10px] px-2 py-0.5">1. Produtos</Badge>
          <div className="h-px flex-1 bg-border" />
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">2. Cotação</Badge>
          <div className="h-px flex-1 bg-border" />
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground">3. Resultado</Badge>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Nome do produto"
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={e => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 text-center"
            placeholder="Qtd"
          />
          <Button size="icon" onClick={handleAdd} disabled={!nome.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button
                key={s.id}
                onClick={() => pickSuggestion(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/20 text-foreground transition-colors border border-border"
              >
                + {s.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione itens para começar sua cotação</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alreadyCount > 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                <Check className="h-3 w-3 inline mr-1" />
                {alreadyCount} produto(s) já na cotação
              </p>
            )}
            {items.map(item => (
              <Card key={item.id} className="border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                    {item.produtoId && (
                      <p className="text-[10px] text-muted-foreground">produto existente</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.id, -1)}
                      disabled={item.quantidade <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={e => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: val } : i));
                      }}
                      className="w-14 h-7 text-center text-sm font-semibold px-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(item.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive/70 hover:text-destructive shrink-0"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Counter + CTA */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-50">
          <p className="text-xs text-muted-foreground text-center mb-2">
            <Package className="h-3 w-3 inline mr-1" />
            {items.length} produto(s) para adicionar{alreadyCount > 0 ? ` · ${alreadyCount} já na cotação` : ""}
          </p>
          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? (
              "Salvando..."
            ) : (
              <>
                Continuar para cotação
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AddProdutosCotacaoPage;
