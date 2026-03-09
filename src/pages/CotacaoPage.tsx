import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Save, RefreshCw, FileWarning, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatNumber } from "@/lib/format";
import * as XLSX from "xlsx";
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

const HIGH_THRESHOLD = 0.25;
const LOW_THRESHOLD = 0.15;
const MIN_SUPPLIERS_FOR_ANALYSIS = 3;

const CotacaoPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [localPrices, setLocalPrices] = useState<Record<string, Record<string, string>>>({});
  const [novaCotacaoOpen, setNovaCotacaoOpen] = useState(false);
  const [novaCotacaoOpt, setNovaCotacaoOpt] = useState<"manter" | "zerar" | null>(null);
  const [legendVisible, setLegendVisible] = useState(true);

  // Inline editing for qty/embalagem/nome
  const [editingField, setEditingField] = useState<Record<string, { quantidade?: string; embalagem?: string; nome?: string }>>({});

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cotacoes").select("*").eq("status", "ativa").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

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

  const { data: precos = [] } = useQuery({
    queryKey: ["precos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const cpIds = cotacaoProdutos.map((cp) => cp.id);
      if (!cpIds.length) return [];
      const { data, error } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      if (error) throw error;
      return data as Preco[];
    },
  });

  const priceMap = useMemo(() => {
    const map: Record<string, Record<string, number | null>> = {};
    precos.forEach((p) => {
      if (!map[p.cotacao_produto_id]) map[p.cotacao_produto_id] = {};
      map[p.cotacao_produto_id][p.fornecedor_id] = p.preco;
    });
    return map;
  }, [precos]);

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

  const savePriceMutation = useMutation({
    mutationFn: async ({ cpId, fornecedorId, preco }: { cpId: string; fornecedorId: string; preco: number | null }) => {
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

  const updateCpMutation = useMutation({
    mutationFn: async ({ cpId, field, value }: { cpId: string; field: string; value: any }) => {
      if (field === "quantidade") {
        const { error } = await supabase.from("cotacao_produtos").update({ quantidade: value }).eq("id", cpId);
        if (error) throw error;
      } else if (field === "nome" || field === "embalagem") {
        // Update the underlying produto
        const cp = cotacaoProdutos.find(c => c.id === cpId);
        if (cp?.produto_id) {
          const { error } = await supabase.from("produtos").update({ [field]: value }).eq("id", cp.produto_id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
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

  const analyzePrices = (cpId: string) => {
    const prices: { fId: string; val: number }[] = [];
    fornecedores.forEach((f) => {
      const rawVal = localPrices[cpId]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
      if (rawVal) {
        const num = parseFloat(rawVal);
        if (!isNaN(num) && num > 0) prices.push({ fId: f.id, val: num });
      }
    });
    if (!prices.length) return { min: null, second: null, minVal: null, tiedCount: 0, allVals: [] };

    const minVal = Math.min(...prices.map((p) => p.val));
    const tied = prices.filter((p) => p.val === minVal);
    const tiedCount = tied.length;
    const allVals = prices.map((p) => p.val);

    prices.sort((a, b) => a.val - b.val);
    return {
      min: tied[0].fId,
      second: prices.length > 1 ? prices.find((p) => p.val !== minVal)?.fId || null : null,
      minVal,
      tiedCount,
      allVals,
    };
  };

  const isHighVariation = (val: number, allVals: number[]) => {
    if (allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return false;
    const sorted = [...allVals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (median <= 0) return false;
    return (val - median) / median > HIGH_THRESHOLD;
  };

  const isLowVariation = (val: number, allVals: number[]) => {
    if (allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return false;
    const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    if (avg <= 0) return false;
    return (avg - val) / avg >= LOW_THRESHOLD;
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    cotacaoProdutos.forEach((cp) => {
      const info = analyzePrices(cp.id);
      if (info.min && info.minVal !== null) {
        total += info.minVal * (cp.quantidade || 1);
      }
    });
    return total;
  }, [localPrices, cotacaoProdutos, fornecedores]);

  const filteredItems = cotacaoProdutos.filter((cp) =>
    !search || cp.produto?.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Realtime
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

  const buildSuspiciousReport = () => {
    const rows: { Produto: string; Embalagem: string; Fornecedor: string; Preço: number; Média: string; Desvio: string; Tipo: string }[] = [];
    cotacaoProdutos.forEach((cp) => {
      const info = analyzePrices(cp.id);
      if (info.allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS) return;
      const avg = info.allVals.reduce((a, b) => a + b, 0) / info.allVals.length;
      fornecedores.forEach((f) => {
        const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
        if (!rawVal) return;
        const num = parseFloat(rawVal);
        if (isNaN(num) || num <= 0) return;
        const hi = isHighVariation(num, info.allVals);
        const lo = isLowVariation(num, info.allVals);
        if (!hi && !lo) return;
        const desvPct = ((num - avg) / avg * 100).toFixed(1);
        rows.push({
          Produto: cp.produto?.nome || "",
          Embalagem: cp.produto?.embalagem || "un",
          Fornecedor: f.nome,
          Preço: num,
          Média: formatNumber(avg),
          Desvio: `${desvPct}%`,
          Tipo: hi ? "⚠️ Acima (+25%)" : "⚠️ Abaixo (-15%)",
        });
      });
    });
    return rows;
  };

  const exportSuspiciousReport = () => {
    const rows = buildSuspiciousReport();
    if (!rows.length) {
      toast.info("Nenhum preço suspeito detectado nesta cotação.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos");
    XLSX.writeFile(wb, `precos-suspeitos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Relatório exportado com ${rows.length} preço(s) suspeito(s).`);
  };

  const handleNovaCotacao = async () => {
    if (!novaCotacaoOpt || !cotacaoAtiva) return;
    try {
      // Export suspicious report before finalizing
      const suspiciousRows = buildSuspiciousReport();
      if (suspiciousRows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(suspiciousRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Preços Suspeitos");
        XLSX.writeFile(wb, `precos-suspeitos-${cotacaoAtiva.nome.replace(/\s+/g, "-")}.xlsx`);
        toast.info(`${suspiciousRows.length} preço(s) suspeito(s) exportado(s) automaticamente.`);
      }

      await supabase.from("cotacoes").update({ status: "finalizada", finalizada_at: new Date().toISOString() }).eq("id", cotacaoAtiva.id);
      const { data: newCot, error } = await supabase.from("cotacoes").insert({ nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`, status: "ativa" }).select().single();
      if (error) throw error;

      if (novaCotacaoOpt === "manter" && newCot) {
        const inserts = cotacaoProdutos.map((cp) => ({
          cotacao_id: newCot.id,
          produto_id: cp.produto_id,
          quantidade: cp.quantidade,
        }));
        if (inserts.length) {
          await supabase.from("cotacao_produtos").insert(inserts);
        }
      }

      queryClient.invalidateQueries();
      setNovaCotacaoOpen(false);
      setNovaCotacaoOpt(null);
      toast.success(novaCotacaoOpt === "manter" ? "Nova cotação iniciada — preços limpos!" : "Cotação reiniciada — lista zerada!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFieldBlur = (cpId: string, field: string, value: string, original: string) => {
    if (value.trim() !== original.trim()) {
      if (field === "quantidade") {
        updateCpMutation.mutate({ cpId, field, value: parseFloat(value) || 1 });
      } else {
        updateCpMutation.mutate({ cpId, field, value: value.trim() });
      }
    }
    setEditingField((prev) => {
      const copy = { ...prev };
      if (copy[cpId]) {
        delete copy[cpId][field as keyof typeof copy[typeof cpId]];
        if (!Object.keys(copy[cpId]).length) delete copy[cpId];
      }
      return copy;
    });
  };

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
    <TooltipProvider>
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
        <Button variant="outline" size="sm" onClick={exportSuspiciousReport}>
          <FileWarning className="h-4 w-4 mr-1" /> Suspeitos
        </Button>
        <Button size="sm" onClick={saveAll} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Nova cotação strip */}
      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-3 flex-wrap">
        <p className="text-xs text-amber-700 flex-1">💡 Inicie uma nova rodada — salva o histórico e limpa os preços.</p>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs" onClick={() => setNovaCotacaoOpen(true)}>
          🔄 Nova Cotação
        </Button>
      </div>

      {/* Legend */}
      {legendVisible && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/50 border-b text-[10px] flex-wrap">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">Legenda:</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-green-500 text-white text-[7px] font-extrabold px-1 rounded">MIN</span> Menor preço
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">≡MIN</span> Empate
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-amber-500 text-white text-[7px] font-extrabold px-1 rounded">2º</span> Segundo menor
          </span>
           <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded">▲</span> +25% acima
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[7px] font-extrabold px-1 rounded">▼</span> -25% abaixo (possível erro)
          </span>
          <button onClick={() => setLegendVisible(false)} className="ml-auto text-muted-foreground hover:text-foreground">✕ ocultar</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap sticky left-0 bg-muted z-20">
                Produto
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-20">Status</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-16">Embal</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-14">QT</th>
              {fornecedores.map((f) => {
                const hasPrice = precos.some((p) => p.fornecedor_id === f.id && p.preco !== null && p.preco > 0);
                return (
                  <th key={f.id} className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap min-w-[100px]">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${hasPrice ? "bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,.2)]" : "bg-muted-foreground/30"}`} />
                    {f.nome}
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-green-700 border-b-2 border-border">MIN</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700 border-b-2 border-border">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={fornecedores.length + 6} className="text-center py-10 text-muted-foreground">
                {cotacaoProdutos.length === 0 ? "Nenhum produto na cotação. Adicione produtos pelo Banco de Produtos." : "Nenhum produto encontrado."}
              </td></tr>
            ) : filteredItems.map((cp) => {
              const info = analyzePrices(cp.id);
              const totalLine = info.minVal !== null ? info.minVal * (cp.quantidade || 1) : null;

              return (
                <tr key={cp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 border-b font-medium text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                    <Input
                      className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent w-full min-w-[120px]"
                      defaultValue={cp.produto?.nome || ""}
                      onBlur={(e) => handleFieldBlur(cp.id, "nome", e.target.value, cp.produto?.nome || "")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    {(() => {
                      const hasAnyPrice = info.allVals.length > 0;
                      const hasAnomaly = hasAnyPrice && info.allVals.length >= MIN_SUPPLIERS_FOR_ANALYSIS && info.allVals.some(v => isHighVariation(v, info.allVals) || isLowVariation(v, info.allVals));
                      const missingSuppliers = hasAnyPrice && info.allVals.length < MIN_SUPPLIERS_FOR_ANALYSIS;
                      const noPrices = !hasAnyPrice;

                      if (noPrices) return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 cursor-help">
                              <XCircle className="h-3.5 w-3.5" /> Erro
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">Nenhum preço informado para este item.</TooltipContent>
                        </Tooltip>
                      );
                      if (hasAnomaly) return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 cursor-help">
                              <AlertTriangle className="h-3.5 w-3.5" /> Verificar
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">Preço(s) com variação suspeita detectada.</TooltipContent>
                        </Tooltip>
                      );
                      if (missingSuppliers) return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 cursor-help">
                              <AlertTriangle className="h-3.5 w-3.5" /> Verificar
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">Menos de {MIN_SUPPLIERS_FOR_ANALYSIS} fornecedores. Análise incompleta.</TooltipContent>
                        </Tooltip>
                      );
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> OK
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-16 mx-auto"
                      defaultValue={cp.produto?.embalagem || "un"}
                      onBlur={(e) => handleFieldBlur(cp.id, "embalagem", e.target.value, cp.produto?.embalagem || "un")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-14 mx-auto"
                      type="number"
                      defaultValue={cp.quantidade || 1}
                      onBlur={(e) => handleFieldBlur(cp.id, "quantidade", e.target.value, String(cp.quantidade || 1))}
                    />
                  </td>
                  {fornecedores.map((f) => {
                    const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
                    const numVal = rawVal ? parseFloat(rawVal) : null;
                    const isMin = numVal !== null && info.minVal !== null && numVal === info.minVal;
                    const isTieMin = isMin && info.tiedCount > 1;
                    const isSecond = info.second === f.id;
                    const hiVar = numVal !== null && isHighVariation(numVal, info.allVals);
                    const loVar = numVal !== null && isLowVariation(numVal, info.allVals);

                    let inputClass = "w-20 text-right font-mono text-xs h-8 px-2";
                    if (isMin) inputClass += " price-best";
                    else if (isSecond) inputClass += " price-second";
                    if (hiVar && !isMin) inputClass += " price-high-var";
                    if (loVar) inputClass += " price-low-var";

                    return (
                      <td key={f.id} className="px-1 py-1 border-b text-center">
                        <div className="relative inline-flex items-center">
                          <Input
                            type="text"
                            placeholder="—"
                            value={localPrices[cp.id]?.[f.id] || ""}
                            onChange={(e) => handlePriceChange(cp.id, f.id, e.target.value)}
                            onBlur={() => handlePriceBlur(cp.id, f.id)}
                            className={inputClass}
                           />
                           {isTieMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">≡MIN</span>}
                           {isMin && !isTieMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-[6px] font-extrabold px-1 rounded">MIN</span>}
                           {isSecond && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[6px] font-extrabold px-1 rounded">2º</span>}
                           {hiVar && !isMin && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <span className="absolute -bottom-1.5 -right-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▲</span>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs text-xs">
                                 <p className="font-bold">⚠️ Preço muito acima da média</p>
                                 <p className="text-[11px] mt-1">+25% acima dos demais fornecedores. Verifique se há erro de digitação.</p>
                               </TooltipContent>
                             </Tooltip>
                           )}
                           {loVar && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <span className="absolute -bottom-1.5 -left-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▼</span>
                               </TooltipTrigger>
                               <TooltipContent side="top" className="max-w-xs text-xs">
                                 <p className="font-bold">⚠️ Preço muito abaixo da média</p>
                                 <p className="text-[11px] mt-1">-25% abaixo dos demais fornecedores. Verifique possível:</p>
                                 <ul className="text-[11px] mt-1 space-y-0.5 list-disc list-inside">
                                   <li>Erro de digitação</li>
                                   <li>Erro de unidade</li>
                                   <li>Cotação incorreta</li>
                                 </ul>
                               </TooltipContent>
                             </Tooltip>
                           )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-green-700">
                    {info.minVal !== null ? `R$${formatNumber(info.minVal)}` : "-"}
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

      {/* Nova Cotação Modal */}
      <Dialog open={novaCotacaoOpen} onOpenChange={setNovaCotacaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔄 Nova Cotação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Salva o histórico atual e reinicia a cotação</p>
          <p className="text-sm text-foreground mt-2">O que deseja fazer com a <strong>lista de produtos</strong>?</p>
          <div className="space-y-3 mt-2">
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "manter" ? "border-[hsl(var(--brand))] bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
              onClick={() => setNovaCotacaoOpt("manter")}
            >
              <input type="radio" name="nc" checked={novaCotacaoOpt === "manter"} readOnly className="mt-1 accent-[hsl(var(--brand))]" />
              <div>
                <div className="text-sm font-bold">Manter lista de itens</div>
                <div className="text-xs text-muted-foreground">Apenas limpa os preços. Os produtos permanecem.</div>
              </div>
            </label>
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "zerar" ? "border-destructive bg-red-50" : "border-border hover:border-muted-foreground/30"}`}
              onClick={() => setNovaCotacaoOpt("zerar")}
            >
              <input type="radio" name="nc" checked={novaCotacaoOpt === "zerar"} readOnly className="mt-1 accent-red-600" />
              <div>
                <div className="text-sm font-bold">Zerar tudo — lista nova</div>
                <div className="text-xs text-muted-foreground">Remove todos os produtos e preços. Começa do zero.</div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaCotacaoOpen(false)}>Cancelar</Button>
            <Button onClick={handleNovaCotacao} disabled={!novaCotacaoOpt} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default CotacaoPage;
