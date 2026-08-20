import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, Plus, Pencil, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CatalogoItemSheet, { CatalogoItem } from "./CatalogoItemSheet";

const PAGE_SIZE = 50;
type Filtro = "todos" | "sem_ean" | "inativos";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sem_ean", label: "Sem EAN" },
  { key: "inativos", label: "Inativos" },
];

export default function CatalogoTab() {
  const qc = useQueryClient();
  const [termoInput, setTermoInput] = useState("");
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState<CatalogoItem | "novo" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(termoInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [termoInput]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-catalogo", termo, filtro, page],
    queryFn: async () => {
      let q = supabase
        .from("catalogo_mestre")
        .select("id, nome, ean, embalagem, fator_embalagem, ativo", { count: "exact" })
        .order("nome", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (termo) {
        if (/^\d+$/.test(termo)) q = q.ilike("ean", `${termo}%`);
        else q = q.ilike("nome", `%${termo}%`);
      }
      if (filtro === "sem_ean") q = q.or("ean.is.null,ean.eq.");
      if (filtro === "inativos") q = q.eq("ativo", false);

      const { data, count, error } = await q;
      if (error) throw error;
      return { itens: (data || []) as CatalogoItem[], total: count || 0 };
    },
    placeholderData: (prev) => prev,
  });

  const itens = data?.itens || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin-catalogo"] });

  const toggleAtivo = async (item: CatalogoItem, ativo: boolean) => {
    setTogglingId(item.id);
    const { error } = await supabase.from("catalogo_mestre").update({ ativo }).eq("id", item.id);
    setTogglingId(null);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: ativo ? "Item reativado" : "Item inativado", description: item.nome });
    invalidar();
  };

  const contador = useMemo(() => {
    if (isLoading) return "Carregando…";
    return `${total.toLocaleString("pt-BR")} ${total === 1 ? "item" : "itens"}`;
  }, [total, isLoading]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={termoInput}
              onChange={(e) => setTermoInput(e.target.value)}
              placeholder="Buscar por nome ou EAN"
              className="pl-8 pr-8"
            />
            {termoInput && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setTermoInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={() => setSheet("novo")} className="sm:w-auto">
            <Plus className="h-4 w-4 mr-1.5" />
            Novo item
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filtro === f.key ? "default" : "outline"}
              onClick={() => { setFiltro(f.key); setPage(0); }}
              className="h-8 text-xs"
            >
              {f.label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            {contador}
          </span>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum item encontrado{termo ? ` para "${termo}"` : ""}.
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nome</th>
                  <th className="text-left px-3 py-2 font-medium w-[140px]">EAN</th>
                  <th className="text-left px-3 py-2 font-medium w-[90px]">Embalagem</th>
                  <th className="text-right px-3 py-2 font-medium w-[70px]">Fator</th>
                  <th className="text-center px-3 py-2 font-medium w-[80px]">Ativo</th>
                  <th className="w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">{it.nome}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.ean || "—"}</td>
                    <td className="px-3 py-2">{it.embalagem || "—"}</td>
                    <td className="px-3 py-2 text-right">{it.fator_embalagem}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={it.ativo}
                        disabled={togglingId === it.id}
                        onCheckedChange={(v) => toggleAtivo(it, v)}
                        aria-label={it.ativo ? "Inativar item" : "Reativar item"}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSheet(it)} aria-label="Editar item">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {itens.map((it) => (
              <Card key={it.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium leading-tight flex-1 break-words">{it.nome}</p>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setSheet(it)} aria-label="Editar item">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{it.ean || "sem EAN"}</span>
                    <span>·</span>
                    <span>{it.embalagem || "—"} ({it.fator_embalagem})</span>
                    {!it.ativo && <Badge variant="secondary" className="text-[10px] py-0">Inativo</Badge>}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-[11px] text-muted-foreground">Visível para clientes</span>
                    <Switch
                      checked={it.ativo}
                      disabled={togglingId === it.id}
                      onCheckedChange={(v) => toggleAtivo(it, v)}
                      aria-label={it.ativo ? "Inativar item" : "Reativar item"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </>
      )}

      <CatalogoItemSheet item={sheet} onClose={() => setSheet(null)} onSaved={() => refetch()} />
    </div>
  );
}
