import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, Sparkles, Loader2, RefreshCw, TrendingUp, TrendingDown, Users, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { generateScenarios, type Scenario } from "@/lib/scenarios";

type Fornecedor = Tables<"fornecedores">;

const ResumoDistribuicaoContent = () => {
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [suppliersOpen, setSuppliersOpen] = useState(true);
  const [distOpen, setDistOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Data fetching (shared) ----
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: allFornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_fornecedores")
        .select("fornecedor_id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const fornecedores = useMemo(() => {
    if (!cotacaoFornecedores.length) return allFornecedores;
    const selectedIds = new Set(cotacaoFornecedores.map((cf: any) => cf.fornecedor_id));
    return allFornecedores.filter((f) => selectedIds.has(f.id));
  }, [allFornecedores, cotacaoFornecedores]);

  const { data: cotacaoProdutos = [] } = useQuery({
    queryKey: ["cotacao-produtos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(*, categorias(nome))")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: precos = [] } = useQuery({
    queryKey: ["precos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id && cotacaoProdutos.length > 0,
    queryFn: async () => {
      const cpIds = cotacaoProdutos.map((cp: any) => cp.id);
      if (!cpIds.length) return [];
      const { data, error } = await supabase.from("precos").select("*").in("cotacao_produto_id", cpIds);
      if (error) throw error;
      return data || [];
    },
  });

  // ---- Previous cotação total for savings comparison ----
  const { data: previousTotal } = useQuery({
    queryKey: ["cotacao-anterior-total", cotacaoAtiva?.id, lojaAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      // Find the most recent finalized cotação before the current one
      let query = supabase
        .from("cotacoes")
        .select("id")
        .eq("status", "finalizada")
        .order("finalizada_at", { ascending: false })
        .limit(1);
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);

      const { data: prevCotacao } = await query.maybeSingle();
      if (!prevCotacao) return null;

      // Get products + prices for the previous cotação
      const { data: prevCps } = await supabase
        .from("cotacao_produtos")
        .select("id, quantidade")
        .eq("cotacao_id", prevCotacao.id);
      if (!prevCps?.length) return null;

      const prevCpIds = prevCps.map((cp) => cp.id);
      const { data: prevPrecos } = await supabase
        .from("precos")
        .select("cotacao_produto_id, preco")
        .in("cotacao_produto_id", prevCpIds)
        .not("preco", "is", null)
        .gt("preco", 0);
      if (!prevPrecos?.length) return null;

      // Calculate best-price total for previous cotação
      let total = 0;
      const qtyMap = Object.fromEntries(prevCps.map((cp) => [cp.id, cp.quantidade || 1]));
      const grouped: Record<string, number[]> = {};
      prevPrecos.forEach((p) => {
        if (!grouped[p.cotacao_produto_id]) grouped[p.cotacao_produto_id] = [];
        grouped[p.cotacao_produto_id].push(Number(p.preco));
      });
      for (const [cpId, prices] of Object.entries(grouped)) {
        total += Math.min(...prices) * (qtyMap[cpId] || 1);
      }
      return total;
    },
  });

  // ---- Stats computation ----
  const stats = useMemo(() => {
    const totalItems = cotacaoProdutos.length;
    const fornecedoresComPreco = new Set(precos.filter((p: any) => p.preco !== null && p.preco > 0).map((p: any) => p.fornecedor_id));
    const responderam = fornecedoresComPreco.size;
    const itensCotados = new Set(precos.filter((p: any) => p.preco !== null && p.preco > 0).map((p: any) => p.cotacao_produto_id)).size;
    const cobertura = totalItems > 0 ? Math.round((itensCotados / totalItems) * 100) : 0;

    const winCount: Record<string, number> = {};
    fornecedores.forEach((f) => { winCount[f.id] = 0; });
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
      const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
      if (winners.length === 1) winCount[winners[0].fornecedor_id] = (winCount[winners[0].fornecedor_id] || 0) + 1;
    });

    const supplierStats = fornecedores.map((f) => {
      let quotedCount = 0;
      let winsCount = 0;
      let totalPedido = 0;
      cotacaoProdutos.forEach((cp: any) => {
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
        const myPrice = cpPrecos.find((p: any) => p.fornecedor_id === f.id);
        if (myPrice) quotedCount++;
        if (cpPrecos.length > 0) {
          const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
          const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
          if (myPrice && myPrice.preco === minPrice) {
            if (winners.length === 1 || winners.sort((a: any, b: any) => (winCount[b.fornecedor_id] || 0) - (winCount[a.fornecedor_id] || 0))[0].fornecedor_id === f.id) {
              winsCount++;
              totalPedido += myPrice.preco * (cp.quantidade || 1);
            }
          }
        }
      });
      const pct = quotedCount > 0 ? Math.round((winsCount / quotedCount) * 100) : 0;
      return { fornecedor: f, quotedCount, winsCount, pct, totalPedido, recv: fornecedoresComPreco.has(f.id) };
    });

    let grandTotal = 0;
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (cpPrecos.length > 0) {
        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        grandTotal += minPrice * (cp.quantidade || 1);
      }
    });

    return { totalItems, responderam, itensCotados, cobertura, grandTotal, supplierStats };
  }, [cotacaoProdutos, precos, fornecedores]);

  // ---- AI Distribution ----
  const runAnalysis = async () => {
    if (!cotacaoAtiva?.id) return;
    setDistOpen(true);
    setAnalysisText("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-distribuicao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro na análise de distribuição");
        setLoading(false);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullText += content; setAnalysisText(fullText); }
          } catch { /* partial */ }
        }
      }
      if (buffer.trim()) {
        for (const raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullText += content; setAnalysisText(fullText); }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na análise");
    } finally {
      setLoading(false);
    }
  };

  // ---- Scenario-based optimization ----
  const runScenarioAnalysis = () => {
    if (!cotacaoAtiva?.id) return;
    setScenarioLoading(true);
    try {
      const result = generateScenarios(cotacaoProdutos, precos, fornecedores);
      setScenarios(result);
      setSelectedScenario(null);
      toast.success(`${result.length} cenário(s) gerado(s)`);
    } catch (e: any) { toast.error(e.message || "Erro ao gerar cenários"); }
    finally { setScenarioLoading(false); }
  };

  const applyScenario = async (scenario: Scenario) => {
    if (!cotacaoAtiva?.id || !user?.id) return;
    setScenarioLoading(true);
    try {
      for (const sf of scenario.fornecedores) {
        const { data: existing } = await supabase.from("pedidos").select("id").eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", sf.fornecedorId).limit(1).maybeSingle();
        if (existing) { await supabase.from("pedidos").update({ total: sf.total, status: "rascunho" as any }).eq("id", existing.id); }
        else { await supabase.from("pedidos").insert({ cotacao_id: cotacaoAtiva.id, fornecedor_id: sf.fornecedorId, total: sf.total, created_by: user.id, loja_id: lojaAtiva?.id || null, status: "rascunho" as any }); }
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedScenario(scenario);
      toast.success("Cenário aplicado! ✅");
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setScenarioLoading(false); }
  };

  if (!cotacaoAtiva) return <div className="py-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;

  return (
    <div className="space-y-4">
      {stats.itensCotados > 0 && !selectedScenario && (
        <div className="bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(var(--brand-dark))] rounded-xl p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-base font-bold flex items-center gap-2 justify-center sm:justify-start"><Zap className="h-5 w-5" /> Simulação de cenários</h3>
              <p className="text-xs opacity-75 mt-1">Compare estratégias de compra e escolha a melhor</p>
            </div>
            <Button onClick={runScenarioAnalysis} disabled={scenarioLoading} size="lg" className="bg-white text-[hsl(var(--brand-dark))] hover:bg-white/90 font-bold shadow-md shrink-0">
              {scenarioLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {scenarioLoading ? "Calculando..." : scenarios ? "Recalcular" : "Simular cenários"}
            </Button>
          </div>
        </div>
      )}
      {scenarios && !selectedScenario && (
        <div className="space-y-3 animate-fade-in">
          {scenarios.map((sc) => {
            const isBaseline = sc.id === "melhor-preco";
            const hasMinIssues = sc.fornecedores.some(s => !s.minimoOk);
            return (
              <div key={sc.id} className={`bg-card border rounded-xl p-4 shadow-sm ${isBaseline ? "border-primary/30" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{sc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{sc.nome}</span>
                      {isBaseline && <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">REFERÊNCIA</span>}
                      {hasMinIssues && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded-full">⚠️ Ped. mínimo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{sc.descricao}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div><div className="text-[10px] text-muted-foreground">Total</div><div className="text-base font-extrabold font-mono text-foreground">{formatBRL(sc.totalGeral)}</div></div>
                      <div><div className="text-[10px] text-muted-foreground">Fornecedores</div><div className="text-base font-bold text-foreground">{sc.numFornecedores}</div></div>
                      {sc.diffVsBaseline !== 0 && (<div><div className="text-[10px] text-muted-foreground">Diferença</div><div className={`text-sm font-bold font-mono ${sc.diffVsBaseline > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>{sc.diffVsBaseline > 0 ? "+" : ""}{formatBRL(sc.diffVsBaseline)}</div></div>)}
                    </div>
                    <div className="mt-3"><Button size="sm" onClick={() => applyScenario(sc)} disabled={scenarioLoading} variant={isBaseline ? "default" : "outline"}>{scenarioLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} Aplicar</Button></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedScenario && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Cenário "{selectedScenario.nome}" aplicado</div>
              <div className="text-xs text-muted-foreground">{selectedScenario.numFornecedores} fornecedor(es) · {formatBRL(selectedScenario.totalGeral)}{selectedScenario.diffVsBaseline > 0 && ` (+${formatBRL(selectedScenario.diffVsBaseline)})`}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setSelectedScenario(null)}>Trocar cenário</Button>
        </div>
      )}
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark))] text-white rounded-xl p-4 shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-65">Total da Compra</div>
          <div className="text-xl font-extrabold tracking-tight mt-1 font-mono">{formatBRL(stats.grandTotal)}</div>
          <div className="text-xs opacity-60 mt-1">{stats.totalItems} produtos</div>
        </div>
        <KpiCard label="Fornecedores" value={String(fornecedores.length)} sub={`${stats.responderam} responderam`} />
        <KpiCard label="Cobertura" value={`${stats.cobertura}%`} sub={`${stats.itensCotados} de ${stats.totalItems}`} />
        <KpiCard label="Itens Cotados" value={String(stats.itensCotados)} sub={`de ${stats.totalItems} total`} />
      </div>

      {/* Resumo Executivo — Economia vs cotação anterior */}
      <SavingsCard previousTotal={previousTotal} currentTotal={stats.grandTotal} />
      <Collapsible open={suppliersOpen} onOpenChange={setSuppliersOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full bg-card border rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Ranking de Fornecedores
            <span className="text-xs font-normal text-muted-foreground">({stats.supplierStats.length})</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${suppliersOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.supplierStats.map((s) => (
              <div key={s.fornecedor.id} className={`bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md ${s.recv ? "border-l-[3px] border-l-green-500" : ""}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{s.fornecedor.nome}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.recv ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {s.recv ? "Recebido" : "Aguardando"}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full my-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${s.pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Preços cotados</span>
                  <span className="font-bold text-foreground">{s.quotedCount}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Menor preço em</span>
                  <span className="font-bold text-green-700">{s.winsCount} ({s.pct}%)</span>
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between items-baseline">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total pedido</span>
                  <span className="text-base font-extrabold text-green-700 font-mono">{formatBRL(s.totalPedido)}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Distribuição IA — collapsible */}
      <Collapsible open={distOpen} onOpenChange={setDistOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full bg-card border rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Distribuição Inteligente
            {analysisText && <span className="text-[10px] font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Gerado</span>}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
              disabled={loading}
              className="h-7 text-xs"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : analysisText ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="ml-1">{loading ? "Analisando..." : analysisText ? "Reanalisar" : "Gerar"}</span>
            </Button>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${distOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {!analysisText && !loading && (
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique em <strong>"Gerar"</strong> para que a IA sugira a melhor distribuição de pedidos
              </p>
            </div>
          )}
          {loading && !analysisText && (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Analisando distribuição com IA...</span>
            </div>
          )}
          {analysisText && (
            <div ref={scrollRef} className="bg-card border rounded-xl p-5 shadow-sm">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{analysisText}</ReactMarkdown>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md group relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-extrabold text-foreground tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function SavingsCard({ previousTotal, currentTotal }: { previousTotal: number | null | undefined; currentTotal: number }) {
  if (previousTotal == null || previousTotal <= 0 || currentTotal <= 0) return null;
  const diff = previousTotal - currentTotal;
  const pct = Math.round((diff / previousTotal) * 100);
  const saved = diff > 0;
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm ${saved ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"}`}>
      <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${saved ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900"}`}>
        {saved ? <TrendingDown className="h-5 w-5 text-green-700 dark:text-green-400" /> : <TrendingUp className="h-5 w-5 text-amber-700 dark:text-amber-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {saved ? "Economia vs cotação anterior" : "Aumento vs cotação anterior"}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
          <span className={`text-lg font-extrabold font-mono ${saved ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {saved ? "-" : "+"}{formatBRL(Math.abs(diff))}
          </span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${saved ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200" : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"}`}>
            {saved ? "↓" : "↑"} {Math.abs(pct)}%
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Anterior: {formatBRL(previousTotal)} → Atual: {formatBRL(currentTotal)}
        </div>
      </div>
    </div>
  );
}

export default ResumoDistribuicaoContent;
