import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { fetchAllProductNames } from "@/lib/supabaseHelpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CatalogoItem {
  id: string;
  nome: string;
  categoria: string;
  embalagem: string;
  fator_embalagem: number;
  ean: string | null;
}

const CatalogoBaseModal = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const { data: catalogo = [], isLoading } = useQuery({
    queryKey: ["catalogo-mestre"],
    queryFn: async () => {
      const items: CatalogoItem[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("catalogo_mestre")
          .select("id, nome, categoria, embalagem, fator_embalagem, ean")
          .eq("ativo", true)
          .order("categoria")
          .order("nome")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) items.push(...(data as CatalogoItem[]));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return items;
    },
    enabled: open,
  });

  const categorias = useMemo(() => {
    const cats = new Map<string, number>();
    catalogo.forEach((p) => cats.set(p.categoria, (cats.get(p.categoria) || 0) + 1));
    return Array.from(cats.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalogo]);

  const filtered = useMemo(() => {
    let items = catalogo;
    if (selectedCat !== "Todos") items = items.filter((p) => p.categoria === selectedCat);
    const q = search.trim().toLowerCase();
    if (q) {
      const isNumeric = /^\d+$/.test(q);
      items = items.filter((p) =>
        p.nome.toLowerCase().includes(q) || (isNumeric && p.ean && p.ean.includes(q))
      );
    }
    return items;
  }, [catalogo, selectedCat, search]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    const catItems = catalogo.filter((p) => p.categoria === cat);
    const allSelected = catItems.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      catItems.forEach((p) => (allSelected ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  };

  const selectAll = () => {
    const ids = filtered.map((p) => p.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const doImport = async () => {
    if (!selectedIds.size || !user?.id) return;
    setImporting(true);
    try {
      const existingNames = await fetchAllProductNames();
      const selected = catalogo.filter((p) => selectedIds.has(p.id));

      // Get existing categories
      const { data: userCats } = await supabase.from("categorias").select("id, nome").eq("user_id", user.id);
      const catMap: Record<string, string> = {};
      (userCats || []).forEach((c) => (catMap[c.nome.toLowerCase()] = c.id));

      // Create missing categories
      const neededCats = [...new Set(selected.map((p) => p.categoria))];
      for (const catName of neededCats) {
        if (!catMap[catName.toLowerCase()] && catName !== "Geral") {
          const { data } = await supabase
            .from("categorias")
            .insert({ nome: catName, user_id: user.id })
            .select("id")
            .single();
          if (data) catMap[catName.toLowerCase()] = data.id;
        }
      }

      // Filter duplicates
      const unique = selected.filter((p) => !existingNames.has(p.nome.toLowerCase().trim()));
      if (!unique.length) {
        toast.info("Todos os produtos selecionados já existem!");
        setImporting(false);
        return;
      }

      // Insert in batches
      let total = 0;
      const batchSize = 50;
      for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize).map((p) => ({
          nome: p.nome,
          categoria_id: catMap[p.categoria.toLowerCase()] || null,
          embalagem: p.embalagem || "un",
          fator_embalagem: p.fator_embalagem || 1,
          ativo: true,
          user_id: user.id,
        }));
        const { error } = await supabase.from("produtos").insert(batch);
        if (error) throw error;
        total += batch.length;
      }

      const dups = selected.length - unique.length;
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success(
        dups > 0
          ? `✅ ${total} produtos importados do catálogo! (${dups} duplicados ignorados)`
          : `✅ ${total} produtos importados do catálogo!`
      );
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    }
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Catálogo Supermercado
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {catalogo.length} produtos pré-cadastrados · Selecione os que deseja importar
          </p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={selectedCat === "Todos" ? "default" : "outline"}
            className="cursor-pointer text-[10px]"
            onClick={() => setSelectedCat("Todos")}
          >
            Todos ({catalogo.length})
          </Badge>
          {categorias.map(([cat, count]) => (
            <Badge
              key={cat}
              variant={selectedCat === cat ? "default" : "outline"}
              className="cursor-pointer text-[10px]"
              onClick={() => setSelectedCat(cat)}
            >
              {cat} ({count})
            </Badge>
          ))}
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between text-xs">
          <button onClick={selectAll} className="text-primary hover:underline">
            {filtered.every((p) => selectedIds.has(p.id)) && filtered.length > 0
              ? "Desmarcar todos"
              : `Selecionar todos (${filtered.length})`}
          </button>
          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {selectedIds.size} selecionados
            </Badge>
          )}
        </div>

        {/* Product list */}
        <ScrollArea className="flex-1 min-h-0 border rounded-lg" style={{ maxHeight: "calc(85vh - 320px)" }}>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Carregando catálogo...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum produto encontrado
            </div>
          ) : (
            <div>
              {selectedCat === "Todos"
                ? categorias.map(([cat]) => {
                    const catItems = filtered.filter((p) => p.categoria === cat);
                    if (!catItems.length) return null;
                    const allCatSelected = catItems.every((p) => selectedIds.has(p.id));
                    return (
                      <div key={cat}>
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10 border-b hover:bg-muted/80"
                        >
                          <Checkbox checked={allCatSelected} className="h-3 w-3" />
                          <span>{cat}</span>
                          <span className="ml-auto font-normal">{catItems.length}</span>
                        </button>
                        {catItems.map((p) => (
                          <ProductRow key={p.id} item={p} selected={selectedIds.has(p.id)} onToggle={toggleItem} />
                        ))}
                      </div>
                    );
                  })
                : filtered.map((p) => (
                    <ProductRow key={p.id} item={p} selected={selectedIds.has(p.id)} onToggle={toggleItem} />
                  ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={doImport}
            disabled={!selectedIds.size || importing}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] gap-1"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importando...
              </>
            ) : (
              <>
                Importar {selectedIds.size} Produtos <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ProductRow = ({ item, selected, onToggle }: { item: CatalogoItem; selected: boolean; onToggle: (id: string) => void }) => (
  <button
    onClick={() => onToggle(item.id)}
    className={`w-full flex items-center gap-2 px-3 py-2 border-b text-left hover:bg-muted/30 transition-colors ${
      selected ? "bg-primary/5" : ""
    }`}
  >
    <Checkbox checked={selected} className="h-3.5 w-3.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-sm truncate">{item.nome}</div>
      <div className="text-[10px] text-muted-foreground">
        {item.embalagem} · fator {item.fator_embalagem}
      </div>
    </div>
  </button>
);

export default CatalogoBaseModal;
