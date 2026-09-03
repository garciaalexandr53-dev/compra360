import React, { useState, useRef, useMemo, useCallback } from "react";
import AdicionarItemDialog from "@/components/shared/AdicionarItemDialog";
import {
  buildSnapshotInsert,
  type ProdutoHibrido,
} from "@/lib/buscaProdutos";
import { useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useUltimaCompra } from "@/hooks/useUltimaCompra";
import { useAuth } from "@/hooks/useAuth";
import { useProdutosHibrido } from "@/hooks/useProdutosHibrido";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import { Plus, Minus, Trash2, ShoppingCart, ArrowLeft, Check, PlusCircle, Search } from "lucide-react";
import DashboardProgress from "@/components/dashboard/DashboardProgress";
import { toast } from "sonner";
import { format } from "date-fns";
import { defaultPrazoHoje } from "@/lib/format";
import { useFeatureCheck } from "@/components/FeatureGate";

interface LocalItem {
  id: string;
  nome: string;
  quantidade: number;
  embalagem: string;
  fator: number;
  produtoId?: string;
  catalogoMestreId?: string;
  ean?: string | null;
}

let localIdCounter = 0;
const genId = () => `local-${++localIdCounter}`;


const AddProdutosCotacaoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const { checkLimit } = useFeatureCheck();

  const [items, setItems] = useState<LocalItem[]>([]);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [dialogItem, setDialogItem] = useState<{
    nome: string;
    embalagem?: string | null;
    fator?: number | null;
    produtoId?: string;
    catalogoMestreId?: string;
    ean?: string | null;
  } | null>(null);


  const [debouncedSearch, setDebouncedSearch] = useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(nome.trim()), 250);
    return () => clearTimeout(timer);
  }, [nome]);

  const PAGE_SIZE = 60;

  // Full paginated list of active products (alphabetical) — shown when search is empty
  const {
    data: allProdutosData,
    fetchNextPage: fetchNextAll,
    hasNextPage: hasMoreAll,
    isFetchingNextPage: isFetchingAll,
  } = useInfiniteQuery({
    queryKey: ["produtos-todos-ativos"],
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from("produtos")
        .select("id, nome, embalagem, fator_embalagem", { count: "exact" })
        .eq("ativo", true)
        .order("nome")
        .range(from, to);
      const totalCount = count ?? 0;
      const hasMore = from + PAGE_SIZE < totalCount;
      return {
        products: data || [],
        nextPage: hasMore ? (pageParam as number) + 1 : undefined,
        totalCount,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  const allProdutos = useMemo(
    () => allProdutosData?.pages.flatMap((p) => p.products) ?? [],
    [allProdutosData]
  );
  const totalProdutos = allProdutosData?.pages[0]?.totalCount ?? 0;

  // Busca híbrida: catalogo_mestre global + produtos locais do usuário.
  // Fonte ÚNICA: hook `useProdutosHibrido` (consome a RPC com a sessão autenticada).
  const { data: existingProdutos, catalogo: catalogoMatches, locais: locaisMatches } =
    useProdutosHibrido({ termo: debouncedSearch, limit: 50 });

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
        .select("produto_id, catalogo_mestre_id, quantidade")
        .eq("cotacao_id", cotacaoAtiva!.id);
      return data || [];
    },
  });

  const alreadyCount = alreadyInCotacao.length;
  const stagedCount = items.length;
  const totalItems = stagedCount + alreadyCount;
  const hasAnyProduct = totalItems > 0;

  // Dialog handlers
  const handlePickSuggestion = (produto: ProdutoHibrido | { id: string; nome: string; embalagem?: string | null; fator_embalagem?: number | null; fonte?: "catalogo" | "local"; ean?: string | null }) => {
    const fonte: "catalogo" | "local" = (produto as ProdutoHibrido).fonte ?? "local";
    setDialogItem({
      nome: produto.nome,
      embalagem: produto.embalagem ?? null,
      fator: produto.fator_embalagem ?? null,
      produtoId: fonte === "local" ? produto.id : undefined,
      catalogoMestreId: fonte === "catalogo" ? produto.id : undefined,
      ean: (produto as ProdutoHibrido).ean ?? null,
    });
  };

  const handlePickNovo = () => {
    setDialogItem({ nome: nome.trim() });
  };

  const handleDialogConfirm = (qtd: number, embalagem: string, fator: number) => {
    if (!dialogItem) return;
    if (items.some(i => i.nome.toLowerCase() === dialogItem.nome.toLowerCase())) {
      toast.error("Produto já adicionado à lista");
      setDialogItem(null);
      return;
    }
    if (!checkLimit("max_produtos", totalItems, "Faça upgrade para adicionar mais produtos à cotação.")) {
      setDialogItem(null);
      return;
    }
    const isFirstProduct = items.length === 0 && alreadyCount === 0;
    setItems(prev => [...prev, {
      id: genId(),
      nome: dialogItem.nome,
      quantidade: qtd,
      embalagem,
      fator,
      produtoId: dialogItem.produtoId,
      catalogoMestreId: dialogItem.catalogoMestreId,
      ean: dialogItem.ean ?? null,
    }]);
    setDialogItem(null);
    // Mantém o termo digitado; o foco volta com o texto selecionado para uma nova busca rápida.
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
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
          prazo_resposta: defaultPrazoHoje(18, 0),
        } as any).select().single();
        if (error) throw error;
        cotacaoId = newCot.id;
      }

      const toInsert: ReturnType<typeof buildSnapshotInsert>[] = [];

      for (const item of items) {
        if (item.catalogoMestreId) {
          // Item do catálogo global — snapshot direto, sem produto local.
          const alreadyExists = alreadyInCotacao.some(
            (a: any) => a.catalogo_mestre_id === item.catalogoMestreId,
          );
          if (alreadyExists) continue;
          toInsert.push(
            buildSnapshotInsert({
              cotacaoId: cotacaoId!,
              produto: {
                fonte: "catalogo",
                id: item.catalogoMestreId,
                nome: item.nome,
                ean: item.ean ?? null,
                embalagem: item.embalagem,
                fator_embalagem: item.fator,
              },
              quantidade: item.quantidade,
            }),
          );
          continue;
        }

        let produtoId = item.produtoId;
        if (!produtoId) {
          const { data: newProd, error } = await supabase.from("produtos").insert({
            nome: item.nome,
            embalagem: item.embalagem,
            fator_embalagem: item.fator,
            ativo: true,
            user_id: user?.id,
          } as any).select("id").single();
          if (error) throw error;
          produtoId = newProd.id;
        }

        const alreadyExists = alreadyInCotacao.some((a: any) => a.produto_id === produtoId);
        if (alreadyExists) continue;
        toInsert.push(
          buildSnapshotInsert({
            cotacaoId: cotacaoId!,
            produto: {
              fonte: "local",
              id: produtoId!,
              nome: item.nome,
              ean: null,
              embalagem: item.embalagem,
              fator_embalagem: item.fator,
            },
            quantidade: item.quantidade,
            embalagem: item.embalagem,
            fator: item.fator,
          }),
        );
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("cotacao_produtos").insert(toInsert as any);
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

  const filterDispo = useCallback(
    (lista: ProdutoHibrido[]) => {
      const localNames = new Set(items.map((i) => i.nome.toLowerCase()));
      return lista.filter((p) => !localNames.has(p.nome.toLowerCase()));
    },
    [items],
  );

  const catalogoSugestoes = useMemo(
    () => filterDispo(catalogoMatches).slice(0, 30),
    [catalogoMatches, filterDispo],
  );
  const locaisSugestoes = useMemo(
    () => filterDispo(locaisMatches).slice(0, 30),
    [locaisMatches, filterDispo],
  );
  const temSugestoes = catalogoSugestoes.length + locaisSugestoes.length > 0;

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
          onFocus={e => e.target.select()}
          autoFocus
          className="h-12 w-full"
        />

        {/* Sugestões agrupadas — catálogo (travado) primeiro, locais (editáveis) depois */}
        {temSugestoes && (
          <div className="space-y-3">
            {catalogoSugestoes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  Catálogo global · embalagem e fator travados
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {catalogoSugestoes.map((s) => (
                    <button
                      key={`cat-${s.id}`}
                      onClick={() => handlePickSuggestion(s)}
                      className="group flex items-start justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-primary/10"
                      title={s.ean ? `EAN ${s.ean}` : "Catálogo global"}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{s.nome}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {s.embalagem || "UNI"}
                          {s.fator_embalagem && s.fator_embalagem > 1 ? ` · ${s.fator_embalagem} un` : ""}
                          {s.ean ? ` · EAN ${s.ean}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/40 rounded-full px-1.5 py-0.5">
                        Catálogo
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {locaisSugestoes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                  Seus produtos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {locaisSugestoes.map((s) => (
                    <button
                      key={`loc-${s.id}`}
                      onClick={() => handlePickSuggestion(s)}
                      className="text-xs px-2.5 py-1 rounded-full border bg-muted text-foreground border-border hover:bg-primary/20 transition-colors"
                      title="Seu cadastro"
                    >
                      + {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

        {/* Full product list — shown when search is empty */}
        {nome.trim().length < 2 && allProdutos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Seus produtos ({totalProdutos}) — toque para adicionar
            </p>
            <div
              className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-card/40"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (!hasMoreAll || isFetchingAll) return;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
                  fetchNextAll();
                }
              }}
            >
              {allProdutos
                .filter(
                  (p) =>
                    !items.some((i) => i.produtoId === p.id) &&
                    !alreadyInCotacao.some((a) => a.produto_id === p.id),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePickSuggestion(s)}
                    className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left text-sm text-foreground transition-colors last:border-b-0 hover:bg-primary/10"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{s.nome}</span>
                  </button>
                ))}
              {isFetchingAll && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  Carregando mais...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quantity Dialog */}
      <AdicionarItemDialog
        produto={dialogItem ? {
          nome: dialogItem.nome,
          embalagem: dialogItem.embalagem,
          fator: dialogItem.fator,
          subtitulo: !dialogItem.catalogoMestreId && dialogItem.produtoId ? "Produto existente no banco" : null,
        } : null}
        ultimaCompra={ultimaCompraAdd}
        onConfirmar={handleDialogConfirm}
        onCancelar={() => setDialogItem(null)}
        badge={dialogItem?.catalogoMestreId ? "Catálogo" : null}
        origemPadrao={dialogItem?.catalogoMestreId ? "catalogo" : "cadastro"}
      />


      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingCart className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {alreadyCount > 0
                ? "Sua cotação já tem produtos"
                : debouncedSearch.trim().length === 0
                  ? "Comece buscando um produto"
                  : "Nenhum produto adicionado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[250px]">
              {alreadyCount > 0
                ? `${alreadyCount} produto(s) já estão prontos para seguir ao próximo passo`
                : debouncedSearch.trim().length === 0
                  ? "Você tem mais de 11.500 produtos prontos. Digite o nome ou escaneie o código de barras."
                  : "Digite o nome de um produto no campo acima"}
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
                      {item.embalagem}{item.fator > 1 ? ` (${item.fator}un)` : ""}{item.produtoId ? " · produto existente" : ""}
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
