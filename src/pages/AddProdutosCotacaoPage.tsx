import React, { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Minus, Trash2, ShoppingCart, ArrowLeft, Check, PlusCircle } from "lucide-react";
import DashboardProgress from "@/components/dashboard/DashboardProgress";
import { toast } from "sonner";
import { format } from "date-fns";

interface LocalItem {
  id: string;
  nome: string;
  quantidade: number;
  embalagem: string;
  produtoId?: string;
}

let localIdCounter = 0;
const genId = () => `local-${++localIdCounter}`;

const AddProdutosCotacaoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();

  const [items, setItems] = useState<LocalItem[]>([]);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [dialogItem, setDialogItem] = useState<{ nome: string; produtoId?: string } | null>(null);
  const [dialogQtd, setDialogQtd] = useState("");
  const [dialogEmb, setDialogEmb] = useState("UNI");
  const dialogInputRef = useRef<HTMLInputElement>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(nome.trim()), 250);
    return () => clearTimeout(timer);
  }, [nome]);

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
  const stagedCount = items.length;
  const totalItems = stagedCount + alreadyCount;
  const hasAnyProduct = totalItems > 0;

  // Dialog handlers
  const handlePickSuggestion = (produto: { id: string; nome: string }) => {
    setDialogItem({ nome: produto.nome, produtoId: produto.id });
    setDialogQtd("");
    setDialogEmb("UNI");
    setTimeout(() => dialogInputRef.current?.focus(), 100);
  };

  const handlePickNovo = () => {
    setDialogItem({ nome: nome.trim() });
    setDialogQtd("");
    setDialogEmb("UNI");
    setTimeout(() => dialogInputRef.current?.focus(), 100);
  };

  const handleDialogConfirm = () => {
    if (!dialogItem) return;
    const qtd = parseInt(dialogQtd || "0");
    if (!qtd || qtd < 1) {
      toast.error("Informe a quantidade (mínimo 1)");
      return;
    }
    if (items.some(i => i.nome.toLowerCase() === dialogItem.nome.toLowerCase())) {
      toast.error("Produto já adicionado à lista");
      setDialogItem(null);
      return;
    }
    const isFirstProduct = items.length === 0 && alreadyCount === 0;
    setItems(prev => [...prev, {
      id: genId(),
      nome: dialogItem.nome,
      quantidade: qtd,
      embalagem: dialogEmb,
      produtoId: dialogItem.produtoId,
    }]);
    setDialogItem(null);
    setNome("");
    setTimeout(() => inputRef.current?.focus(), 100);
    if (isFirstProduct) {
      toast.success("🎉 Primeiro produto adicionado!");
    } else {
      toast.success("Produto adicionado ✔", { duration: 1500 });
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
    if (items.length === 0) {
      navigate("/dashboard");
      return;
    }
    setSaving(true);

    try {
      let cotacaoId = cotacaoAtiva?.id;

      if (!cotacaoId) {
        const cotNome = `Cotação ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
        const { data: newCot, error } = await supabase.from("cotacoes").insert({
          nome: cotNome,
          loja_id: lojaAtiva?.id || null,
          created_by: user?.id,
        }).select().single();
        if (error) throw error;
        cotacaoId = newCot.id;
      }

      const toInsert: { cotacao_id: string; produto_id: string; quantidade: number }[] = [];

      for (const item of items) {
        let produtoId = item.produtoId;

        if (!produtoId) {
          const { data: newProd, error } = await supabase.from("produtos").insert({
            nome: item.nome,
            embalagem: item.embalagem,
            user_id: user?.id,
          }).select("id").single();
          if (error) throw error;
          produtoId = newProd.id;
        }

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

  const suggestions = useMemo(() => {
    if (nome.trim().length < 2) return [];
    const term = nome.toLowerCase();
    const localNames = new Set(items.map(i => i.nome.toLowerCase()));
    return existingProdutos
      .filter(p => p.nome.toLowerCase().includes(term) && !localNames.has(p.nome.toLowerCase()))
      .slice(0, 5);
  }, [nome, existingProdutos, items]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Adicionar produtos</h1>
              <p className="text-sm text-muted-foreground">Monte sua lista para cotação</p>
            </div>
          </div>

          <DashboardProgress currentStep={1} />

          <div className="min-h-6">
            {hasAnyProduct ? (
              <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground animate-in fade-in-0 zoom-in-95 duration-300">
                <Check className="h-4 w-4 text-primary" />
                {totalItems} produto{totalItems === 1 ? "" : "s"} na cotação
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Adicione produtos para iniciar a cotação</p>
            )}
          </div>
        </div>
      </div>

      {/* Form — search only */}
      <div className="p-4 space-y-3">
        <Input
          ref={inputRef}
          placeholder="Buscar produto..."
          value={nome}
          onChange={e => setNome(e.target.value)}
          autoFocus
          className="h-12 w-full"
        />

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button
                key={s.id}
                onClick={() => handlePickSuggestion(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary/20 text-foreground transition-colors border border-border"
              >
                + {s.nome}
              </button>
            ))}
          </div>
        )}

        {/* Cadastrar novo */}
        {nome.trim().length >= 2 && !existingProdutos.some(p => p.nome.toLowerCase() === nome.trim().toLowerCase()) && (
          <button
            onClick={handlePickNovo}
            className="flex items-center gap-2 w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>Cadastrar <strong>"{nome.trim()}"</strong> como novo produto</span>
          </button>
        )}
      </div>

      {/* Quantity Dialog */}
      <Dialog open={!!dialogItem} onOpenChange={(open) => { if (!open) setDialogItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold truncate">
              {dialogItem?.nome}
            </DialogTitle>
            {dialogItem?.produtoId && (
              <p className="text-xs text-muted-foreground">Produto existente no banco</p>
            )}
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantidade</label>
            <Input
              ref={dialogInputRef}
              type="number"
              inputMode="numeric"
              placeholder="Ex: 10"
              value={dialogQtd}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDialogQtd(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDialogConfirm();
              }}
              className="h-12 text-center text-lg font-bold"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Embalagem</label>
            <div className="flex flex-wrap gap-2">
              {["UNI", "CX", "DZ", "FD", "KG", "PCT"].map(emb => (
                <button
                  key={emb}
                  onClick={() => setDialogEmb(emb)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    dialogEmb === emb
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {emb}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogItem(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-primary/80"
              onClick={handleDialogConfirm}
            >
              ✅ Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {alreadyCount > 0 ? "Sua cotação já tem produtos" : "Nenhum produto ainda"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {alreadyCount > 0
                ? `${alreadyCount} produto(s) já estão prontos para seguir ao próximo passo`
                : "Adicione itens para começar sua cotação"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alreadyCount > 0 && (
              <p className="mb-2 text-xs text-muted-foreground">
                <Check className="h-3 w-3 inline mr-1" />
                {alreadyCount} produto(s) já na cotação
              </p>
            )}
            {items.map((item, index) => (
              <Card
                key={item.id}
                className="border-border border-l-4 border-l-primary bg-card/90 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.embalagem}{item.produtoId ? " · produto existente" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => updateQty(item.id, -1)}
                      disabled={item.quantidade <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={qtyDrafts[item.id] ?? String(item.quantidade)}
                      onFocus={(e) => {
                        e.target.select();
                        setQtyDrafts(s => ({ ...s, [item.id]: "" }));
                      }}
                      onChange={e => setQtyDrafts(s => ({ ...s, [item.id]: e.target.value }))}
                      onBlur={e => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: val } : i));
                        setQtyDrafts(s => { const n = { ...s }; delete n[item.id]; return n; });
                      }}
                      className="h-11 w-16 px-1 text-center text-base font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => updateQty(item.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-destructive/70 hover:text-destructive"
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
      {hasAnyProduct && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+64px)] left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur animate-in slide-in-from-bottom-6 fade-in-0 duration-300">
          <Button
            className="h-14 w-full gap-2 bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-lg"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? (
              "Salvando..."
            ) : (
              <span className="flex flex-col items-center leading-tight">
                <span>✅ Pronto! Selecionar fornecedores →</span>
                <span className="text-xs font-normal opacity-80">{totalItems} produto{totalItems === 1 ? "" : "s"} adicionado{totalItems === 1 ? "" : "s"} à cotação</span>
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AddProdutosCotacaoPage;
