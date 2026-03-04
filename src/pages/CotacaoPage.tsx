import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatNumber } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;
type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };

interface CotacaoProduto {
  id: string;
  produto_id: string;
  cotacao_id: string;
  quantidade: number | null;
  produto?: Produto;
}

interface Preco {
  id: string;
  cotacao_produto_id: string;
  fornecedor_id: string;
  preco: number | null;
}

const CotacaoPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [localPrices, setLocalPrices] = useState<Record<string, Record<string, string>>>({});

  // Fetch active cotação
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("*")
        .eq("status", "ativa")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch fornecedores
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  // Fetch cotação products
  const { data: cotacaoProdutos = [] } = useQuery({
    queryKey: ["cotacao-produtos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(*, categorias(nome))")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return (data || []).map((cp: any) => ({
        id: cp.id,
        produto_id: cp.produto_id,
        cotacao_id: cp.cotacao_id,
        quantidade: cp.quantidade,
        produto: cp.produtos,
      })) as CotacaoProduto[];
    },
  });

  // Fetch precos
  const { data: precos = [] } = useQuery({
    queryKey: ["precos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (!cpIds.length) return [];
      const { data, error } = await supabase
        .from("precos")
        .select("*")
        .in("cotacao_produto_id", cpIds);
      if (error) throw error;
      return data as Preco[];
    },
  });

  // Price map: cotacao_produto_id -> fornecedor_id -> preco
  const priceMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    precos.forEach((p) => {
      if (!map[p.cotacao_produto_id]) map[p.cotacao_produto_id] = {};
      map[p.cotacao_produto_id][p.fornecedor_id] = p.preco;
    });
    return map;
  }, [precos]);

  // Init local prices from DB
  useEffect(() => {
    const lp: Record<string, Record<string, string>> = {};
    cotacaoProdutos.forEach((cp) => {
      lp[cp.id] = {};
      fornecedores.forEach((f) => {
        const val = priceMap[cp.id]?.[f.id];
        lp[cp.id][f.id] = val !== null && val !== undefined ? formatNumber(val) : "";
      });
    });
    setLocalPrices(lp);
  }, [cotacaoProdutos, fornecedores, priceMap]);

  // Save price mutation
  const savePriceMutation = useMutation({
    mutationFn: async ({ cpId, fornecedorId, preco }: { cpId: string; fornecedorId: string; preco: number | null }) => {
      // Upsert
      const existing = precos.find((p) => p.cotacao_produto_id === cpId && p.fornecedor_id === fornecedorId);
      if (existing) {
        const { error } = await supabase.from("precos").update({ preco }).eq("id", existing.id);
        if (error) throw error;
      } else if (preco !== null) {
        const { error } = await supabase.from("precos").insert({ cotacao_produto_id: cpId, fornecedor_id: fornecedorId, preco });
        if (error) throw error;
      }
    },
  });

  const handlePriceChange = (cpId: string, fornecedorId: string, value: string) => {
    setLocalPrices((prev) => ({
      ...prev,
      [cpId]: { ...prev[cpId], [fornecedorId]: value },
    }));
  };

  const handlePriceBlur = (cpId: string, fornecedorId: string) => {
    const rawVal = localPrices[cpId]?.[fornecedorId]?.replace(",", ".").replace(/[^0-9.]/g, "");
    const numVal = rawVal ? parseFloat(rawVal) : null;
    savePriceMutation.mutate({ cpId, fornecedorId, preco: numVal });
  };

  const saveAll = async () => {
    const promises: Promise<any>[] = [];
    Object.entries(localPrices).forEach(([cpId, fPrices]) => {
      Object.entries(fPrices).forEach(([fId, val]) => {
        const numVal = val ? parseFloat(val.replace(",", ".").replace(/[^0-9.]/g, "")) : null;
        const currentDb = priceMap[cpId]?.[fId] ?? null;
        if (numVal !== currentDb) {
          promises.push(savePriceMutation.mutateAsync({ cpId, fornecedorId: fId, preco: isNaN(numVal!) ? null : numVal }));
        }
      });
    });
    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ["precos"] });
    toast.success("Preços salvos!");
  };

  // Calculate min prices for highlighting
  const getMinPrices = (cpId: string) => {
    const prices: { fId: string; val: number }[] = [];
    fornecedores.forEach((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (rawVal) {
        const num = parseFloat(rawVal);
        if (!isNaN(num) && num > 0) prices.push({ fId: f.id, val: num });
      }
    });
    if (!prices.length) return { min: null, second: null };
    prices.sort((a, b) => a.val - b.val);
    return { min: prices[0]?.fId || null, second: prices[1]?.fId || null };
  };

  // Grand total
  const grandTotal = useMemo(() => {
    let total = 0;
    cotacaoProdutos.forEach((cp) => {
      const minInfo = getMinPrices(cp.id);
      if (minInfo.min) {
        const rawVal = localPrices[cp.id]?.[minInfo.min]?.replace(",", ".").replace(/[^0-9.]/g, "");
        const price = rawVal ? parseFloat(rawVal) : 0;
        total += price * (cp.quantidade || 1);
      }
    });
    return total;
  }, [localPrices, cotacaoProdutos, fornecedores]);

  // Filtered items
  const filteredItems = cotacaoProdutos.filter((cp) =>
    !search || cp.produto?.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Subscribe to realtime price updates
  useEffect(() => {
    if (!cotacaoAtiva?.id) return;
    const channel = supabase
      .channel("precos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "precos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["precos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cotacaoAtiva?.id, queryClient]);

  if (!cotacaoAtiva) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <p className="text-lg font-semibold mb-2">Nenhuma cotação ativa</p>
        <p className="text-sm">Crie uma nova cotação para começar.</p>
        <Button className="mt-4 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]" onClick={async () => {
          const { error } = await supabase.from("cotacoes").insert({ nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`, status: "ativa" });
          if (error) toast.error(error.message);
          else { queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] }); toast.success("Cotação criada!"); }
        }}>
          + Nova Cotação
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="p-3 border-b bg-card flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
        <Button size="sm" onClick={saveAll} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/50 border-b text-[10px] flex-wrap">
        <span className="font-bold uppercase tracking-wider text-muted-foreground">Legenda:</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="bg-green-500 text-white text-[7px] font-extrabold px-1 rounded">MIN</span> Menor preço
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="bg-amber-500 text-white text-[7px] font-extrabold px-1 rounded">2º</span> Segundo menor
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap sticky left-0 bg-muted z-20">
                Produto
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-12">
                QT
              </th>
              {fornecedores.map((f) => (
                <th key={f.id} className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap min-w-[100px]">
                  {f.nome}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-green-700 border-b-2 border-border">
                MIN
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700 border-b-2 border-border">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={fornecedores.length + 4} className="text-center py-10 text-muted-foreground">
                {cotacaoProdutos.length === 0 ? "Nenhum produto na cotação. Adicione produtos pelo Banco de Produtos." : "Nenhum produto encontrado."}
              </td></tr>
            ) : filteredItems.map((cp) => {
              const minInfo = getMinPrices(cp.id);
              // Calculate min price value and total
              let minPrice: number | null = null;
              if (minInfo.min) {
                const raw = localPrices[cp.id]?.[minInfo.min]?.replace(",", ".").replace(/[^0-9.]/g, "");
                minPrice = raw ? parseFloat(raw) : null;
              }
              const totalLine = minPrice !== null ? minPrice * (cp.quantidade || 1) : null;

              return (
                <tr key={cp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 border-b font-medium text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                    {cp.produto?.nome}
                    {cp.produto?.embalagem && (
                      <span className="text-xs text-muted-foreground ml-2">{cp.produto.embalagem}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-b text-center text-muted-foreground">{cp.quantidade || 1}</td>
                  {fornecedores.map((f) => {
                    const isMin = minInfo.min === f.id;
                    const isSecond = minInfo.second === f.id;
                    return (
                      <td key={f.id} className="px-1 py-1 border-b text-center">
                        <div className="relative inline-flex items-center">
                          <Input
                            type="text"
                            placeholder="—"
                            value={localPrices[cp.id]?.[f.id] || ""}
                            onChange={(e) => handlePriceChange(cp.id, f.id, e.target.value)}
                            onBlur={() => handlePriceBlur(cp.id, f.id)}
                            className={`w-20 text-right font-mono text-xs h-8 px-2 ${
                              isMin ? "bg-green-50 border-green-200 text-green-700 font-bold" :
                              isSecond ? "bg-amber-50 border-amber-100 text-amber-700" : ""
                            }`}
                          />
                          {isMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-[6px] font-extrabold px-1 rounded">MIN</span>}
                          {isSecond && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[6px] font-extrabold px-1 rounded">2º</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-green-700">
                    {minPrice !== null ? `R$${formatNumber(minPrice)}` : "-"}
                  </td>
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-amber-700">
                    {totalLine !== null ? formatBRL(totalLine) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total bar */}
      <div className="border-t bg-card px-5 py-3 flex items-center justify-end gap-4 shadow-[0_-4px_20px_rgba(15,20,34,.08)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total da Compra</span>
        <span className="text-xl font-extrabold text-green-700 font-mono tracking-tight">{formatBRL(grandTotal)}</span>
      </div>
    </div>
  );
};

export default CotacaoPage;
