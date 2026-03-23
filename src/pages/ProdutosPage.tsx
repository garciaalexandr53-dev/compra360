import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Pencil, Trash2, Check, Upload, ChevronLeft, ChevronRight, Sparkles, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import ImportProdutosModal from "@/components/ImportProdutosModal";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import type { Tables } from "@/integrations/supabase/types";

type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };
type Categoria = Tables<"categorias">;

const emptyForm = { nome: "", categoria_id: "", embalagem: "" };

const ProdutosPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [catSidebarOpen, setCatSidebarOpen] = useState(false);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [inlineEditing, setInlineEditing] = useState<Record<string, { nome?: string; embalagem?: string }>>({});
  const [classifying, setClassifying] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("nome");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*, categorias(nome)")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
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

  const createCatMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("categorias").insert({ nome: nome.trim() });
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
        embalagem: form.embalagem.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Produto atualizado!" : "Produto adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cleanOrphanCategories = async () => {
    const { data: allCats } = await supabase.from("categorias").select("id");
    if (!allCats?.length) return;
    const { data: usedCats } = await supabase.from("produtos").select("categoria_id");
    const usedIds = new Set((usedCats || []).map((p) => p.categoria_id).filter(Boolean));
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

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from("produtos").update({ [field]: value.trim() || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  const toggleCotacaoMutation = useMutation({
    mutationFn: async ({ id, ativo, produtoId }: { id: string; ativo: boolean; produtoId: string }) => {
      const { error: updateErr } = await supabase.from("produtos").update({ ativo }).eq("id", id);
      if (updateErr) throw updateErr;

      if (ativo && cotacaoAtiva) {
        const { error: insertErr } = await supabase.from("cotacao_produtos").insert({
          cotacao_id: cotacaoAtiva.id,
          produto_id: produtoId,
          quantidade: 1,
        });
        if (insertErr) throw insertErr;
      } else if (!ativo && cotacaoAtiva) {
        const { error: deleteErr } = await supabase.from("cotacao_produtos")
          .delete()
          .eq("cotacao_id", cotacaoAtiva.id)
          .eq("produto_id", produtoId);
        if (deleteErr) throw deleteErr;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      toast.success(variables.ativo ? "Produto adicionado à cotação!" : "Produto removido da cotação");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = produtos.filter((p) => {
    const matchCat = selectedCat === "Todos" || p.categorias?.nome === selectedCat;
    const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

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
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Produto) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      categoria_id: p.categoria_id || "",
      embalagem: p.embalagem || "",
    });
    setModalOpen(true);
  };

  const handleInlineBlur = (id: string, field: string, value: string, original: string) => {
    if (value.trim() !== original.trim()) {
      inlineUpdateMutation.mutate({ id, field, value });
    }
    setInlineEditing((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const autoClassifyProducts = async () => {
    const uncategorized = produtos.filter((p) => !p.categoria_id);
    const targets = uncategorized.length > 0 ? uncategorized : filtered;
    if (!targets.length) {
      toast.info("Nenhum produto para classificar.");
      return;
    }
    setClassifying(true);
    try {
      const existingCatNames = categorias.map((c) => c.nome);
      const resp = await supabase.functions.invoke("ai-automacao", {
        body: {
          type: "classify-products",
          products: targets.map((p) => ({ nome: p.nome })),
          existing_categories: existingCatNames,
        },
      });
      if (resp.error) throw new Error(resp.error.message);
      const classifications = resp.data?.classifications || [];
      if (!classifications.length) {
        toast.info("IA não conseguiu classificar os produtos.");
        setClassifying(false);
        return;
      }

      // Build cat map
      const catMap: Record<string, string> = {};
      categorias.forEach((c) => { catMap[c.nome.toLowerCase()] = c.id; });

      // Create new categories
      const allCatNames = classifications.map((c: any) => String(c.categoria || "")).filter((c: string) => c && !catMap[c.toLowerCase()]);
      const newCats = Array.from(new Set<string>(allCatNames));
      for (const catName of newCats) {
        const { data, error } = await supabase.from("categorias").insert([{ nome: catName }]).select("id").single();
        if (!error && data) catMap[catName.toLowerCase()] = data.id;
      }

      // Update products
      let updated = 0;
      for (const cl of classifications) {
        const catId = catMap[cl.categoria?.toLowerCase()];
        if (!catId) continue;
        const prod = targets.find((p) => p.nome.toLowerCase() === cl.nome?.toLowerCase());
        if (prod) {
          const { error } = await supabase.from("produtos").update({ categoria_id: catId }).eq("id", prod.id);
          if (!error) updated++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success(`🤖 ${updated} produtos classificados pela IA!`);
    } catch (e: any) {
      toast.error(e.message || "Erro na classificação automática");
    }
    setClassifying(false);
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
                <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-full">{produtos.length}</span>
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
        <div className="p-3 border-b bg-card space-y-2">
          <div className="flex items-center gap-3">
            {!catSidebarOpen && (
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setCatSidebarOpen(true)} title="Mostrar categorias">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={() => setEditMode(false)}>
                  <Check className="h-4 w-4 mr-1" /> Concluir
                </Button>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1" /> Novo
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  if (confirm(`Excluir TODOS os ${produtos.length} produtos?`)) deleteAllMutation.mutate();
                }} disabled={deleteAllMutation.isPending || produtos.length === 0}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir Todos
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" /> Importar Produtos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={autoClassifyProducts} disabled={classifying || produtos.length === 0}>
                    <Sparkles className="h-4 w-4 mr-2" /> {classifying ? "Classificando..." : "Classificar IA"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Modo Edição
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, prods]) => (
              <div key={cat}>
                {selectedCat === "Todos" && (
                  <div className="px-4 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10 border-b">
                    {cat}
                  </div>
                )}
                {prods.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      {editMode ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            className="h-7 text-sm font-medium w-auto flex-1 min-w-[150px]"
                            defaultValue={p.nome}
                            onBlur={(e) => handleInlineBlur(p.id, "nome", e.target.value, p.nome)}
                          />
                          <Input
                            className="h-7 text-xs w-20"
                            defaultValue={p.embalagem || ""}
                            placeholder="embal."
                            onBlur={(e) => handleInlineBlur(p.id, "embalagem", e.target.value, p.embalagem || "")}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-foreground">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.categorias?.nome || "Sem Categoria"} · {p.embalagem || "un"}
                          </div>
                        </>
                      )}
                    </div>
                    {editMode ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                          if (confirm(`Remover "${p.nome}"?`)) deleteMutation.mutate(p.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={p.ativo ? "outline" : "default"}
                        className={p.ativo ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : "bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white"}
                        onClick={() => toggleCotacaoMutation.mutate({ id: p.id, ativo: !p.ativo, produtoId: p.id })}
                      >
                        {p.ativo ? "✓ Na cotação" : "+ Adicionar"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </ScrollArea>
      </div>

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
            <div><Label>Embalagem</Label><Input placeholder="cx, un, fd..." value={form.embalagem} onChange={(e) => setForm({ ...form, embalagem: e.target.value })} /></div>
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
    </div>
  );
};

export default ProdutosPage;
