import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };
type Categoria = Tables<"categorias">;

const emptyForm = { nome: "", categoria_id: "", embalagem: "" };

const ProdutosPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("Todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  // Group products by category
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

  // Category counts
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Category sidebar */}
      <div className="w-56 flex-shrink-0 bg-card border-r flex flex-col">
        <div className="p-3 border-b">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categorias</span>
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
          </div>
        </ScrollArea>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-3 border-b bg-card flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</span>
          <div className="ml-auto flex gap-2">
            <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? <><Check className="h-4 w-4 mr-1" /> Concluir</> : <><Pencil className="h-4 w-4 mr-1" /> Editar</>}
            </Button>
            {editMode && (
              <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
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
                      <div className="text-sm font-medium text-foreground">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.categorias?.nome || "Sem Categoria"} · {p.embalagem || "un"}
                      </div>
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
                        onClick={() => toggleAtivoMutation.mutate({ id: p.id, ativo: !p.ativo })}
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

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do Produto *</Label><Input placeholder="Ex: Detergente Ype 500ml" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <select
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
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
    </div>
  );
};

export default ProdutosPage;
