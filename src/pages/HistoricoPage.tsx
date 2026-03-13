import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatNumber } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const HistoricoPage = () => {
  const queryClient = useQueryClient();
  const [searchItem, setSearchItem] = useState("");
  const [searchCotacao, setSearchCotacao] = useState("");
  const [expandedCotacao, setExpandedCotacao] = useState<string | null>(null);

  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["cotacoes-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("*")
        .neq("status", "ativa")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables<"cotacoes">[];
    },
  });

  const { data: cotacaoDetails = { produtos: [], precos: [] } as { produtos: any[]; precos: any[] } } = useQuery<{ produtos: any[]; precos: any[] }>({
    queryKey: ["cotacao-details", expandedCotacao],
    enabled: !!expandedCotacao,
    queryFn: async () => {
      const { data: cps, error: cpErr } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(nome, embalagem)")
        .eq("cotacao_id", expandedCotacao!);
      if (cpErr) throw cpErr;

      const cpIds = (cps || []).map((cp: any) => cp.id);
      let precos: any[] = [];
      if (cpIds.length) {
        const { data: p } = await supabase.from("precos").select("*, fornecedores(nome)").in("cotacao_produto_id", cpIds);
        precos = p || [];
      }

      return { produtos: cps || [], precos };
    },
  });

  const { data: itemSearchResults = [] } = useQuery({
    queryKey: ["item-search", searchItem],
    enabled: searchItem.length >= 2,
    queryFn: async () => {
      const { data: prods } = await supabase
        .from("produtos")
        .select("id, nome")
        .ilike("nome", `%${searchItem}%`)
        .limit(20);
      if (!prods?.length) return [];

      const prodIds = prods.map((p) => p.id);

      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("*, cotacoes(nome, created_at, status), produtos(nome, embalagem)")
        .in("produto_id", prodIds)
        .order("cotacao_id");
      if (!cps?.length) return [];

      const cpIds = cps.map((cp: any) => cp.id);
      const { data: precos } = await supabase
        .from("precos")
        .select("*, fornecedores(nome)")
        .in("cotacao_produto_id", cpIds)
        .not("preco", "is", null);

      return cps.map((cp: any) => ({
        ...cp,
        precos: (precos || []).filter((p: any) => p.cotacao_produto_id === cp.id),
      }));
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const ids = cotacoes.map((c) => c.id);
      if (!ids.length) return;
      // Delete precos for those cotacoes' products
      for (const cotId of ids) {
        const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotId);
        if (cps?.length) {
          const cpIds = cps.map((cp: any) => cp.id);
          await supabase.from("precos").delete().in("cotacao_produto_id", cpIds);
        }
        await supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotId);
        await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotId);
      }
      await supabase.from("cotacoes").delete().in("id", ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes-historico"] });
      setExpandedCotacao(null);
      toast.success("Histórico limpo com sucesso!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (cotId: string) => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotId);
      if (cps?.length) {
        const cpIds = cps.map((cp: any) => cp.id);
        await supabase.from("precos").delete().in("cotacao_produto_id", cpIds);
      }
      await supabase.from("cotacao_produtos").delete().eq("cotacao_id", cotId);
      await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotId);
      await supabase.from("cotacoes").delete().eq("id", cotId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacoes-historico"] });
      setExpandedCotacao(null);
      toast.success("Cotação removida!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const filteredCotacoes = cotacoes.filter((c) =>
    !searchCotacao || c.nome.toLowerCase().includes(searchCotacao.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedCotacao(expandedCotacao === id ? null : id);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">🕐 Histórico de Cotações</h1>
        {cotacoes.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" /> Limpar Histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ Limpar todo o histórico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá remover permanentemente <strong>{cotacoes.length} cotação(ões)</strong> finalizadas e todos os preços associados. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearHistoryMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, limpar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Tabs defaultValue="cotacoes">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="cotacoes" className="flex-1">📋 Por Cotação</TabsTrigger>
          <TabsTrigger value="itens" className="flex-1">🔍 Buscar por Item</TabsTrigger>
        </TabsList>

        <TabsContent value="cotacoes" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cotação..."
              value={searchCotacao}
              onChange={(e) => setSearchCotacao(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Carregando...</div>
          ) : filteredCotacoes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Nenhuma cotação finalizada ainda.</div>
          ) : (
            filteredCotacoes.map((c) => (
              <div key={c.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(c.id)}
                >
                  <div>
                    <div className="text-sm font-bold text-foreground">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover "{c.nome}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa cotação e todos os seus preços serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSingleMutation.mutate(c.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      c.status === "finalizada" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {c.status}
                    </span>
                    {expandedCotacao === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedCotacao === c.id && cotacaoDetails.produtos && (
                  <div className="border-t">
                    <ScrollArea className="max-h-[400px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="px-3 py-2 text-left font-bold">Produto</th>
                            <th className="px-3 py-2 text-center font-bold">Embal</th>
                            <th className="px-3 py-2 text-center font-bold">Qtd</th>
                            <th className="px-3 py-2 text-left font-bold">Preços</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cotacaoDetails.produtos.map((cp: any) => {
                            const cpPrecos = cotacaoDetails.precos.filter((p: any) => p.cotacao_produto_id === cp.id);
                            const minPreco = cpPrecos.length ? Math.min(...cpPrecos.map((p: any) => p.preco)) : null;
                            return (
                              <tr key={cp.id} className="border-t hover:bg-muted/20">
                                <td className="px-3 py-2 font-medium">{cp.produtos?.nome}</td>
                                <td className="px-3 py-2 text-center text-muted-foreground">{cp.produtos?.embalagem || "un"}</td>
                                <td className="px-3 py-2 text-center">{cp.quantidade || 1}</td>
                                <td className="px-3 py-2">
                                  {cpPrecos.length === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {cpPrecos.sort((a: any, b: any) => a.preco - b.preco).map((p: any) => (
                                        <span
                                          key={p.id}
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                            p.preco === minPreco ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                                          }`}
                                        >
                                          {p.fornecedores?.nome}: R${formatNumber(p.preco)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="itens" className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto (ex: Detergente)..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="pl-9"
            />
          </div>

          {searchItem.length < 2 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Digite pelo menos 2 caracteres para buscar.
            </div>
          ) : itemSearchResults.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum resultado encontrado para "{searchItem}".
            </div>
          ) : (
            (() => {
              const grouped: Record<string, { nome: string; embalagem: string; entries: typeof itemSearchResults }> = {};
              itemSearchResults.forEach((item: any) => {
                const key = item.produtos?.nome || "?";
                if (!grouped[key]) grouped[key] = { nome: key, embalagem: item.produtos?.embalagem || "un", entries: [] };
                grouped[key].entries.push(item);
              });

              return Object.values(grouped).map((group) => (
                <div key={group.nome} className="bg-card border rounded-xl shadow-sm overflow-hidden mb-3">
                  <div className="px-4 py-3 bg-muted/30 border-b">
                    <span className="font-bold text-sm text-foreground">{group.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">({group.embalagem})</span>
                  </div>
                  <div className="divide-y">
                    {group.entries
                      .sort((a: any, b: any) => {
                        const da = a.cotacoes?.created_at || "";
                        const db = b.cotacoes?.created_at || "";
                        return db.localeCompare(da);
                      })
                      .map((item: any) => {
                        const minPreco = item.precos.length ? Math.min(...item.precos.map((p: any) => p.preco)) : null;
                        return (
                          <div key={item.id} className="px-4 py-2.5 flex items-start gap-4">
                            <div className="min-w-[140px]">
                              <div className="text-xs font-medium text-muted-foreground">
                                {item.cotacoes?.created_at ? formatDateTime(item.cotacoes.created_at) : "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground/70">{item.cotacoes?.nome}</div>
                            </div>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {item.precos.length === 0 ? (
                                <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                item.precos.sort((a: any, b: any) => a.preco - b.preco).map((p: any) => (
                                  <span
                                    key={p.id}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      p.preco === minPreco ? "bg-blue-50 text-blue-600" : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {p.fornecedores?.nome}: R${formatNumber(p.preco)}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ));
            })()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HistoricoPage;
