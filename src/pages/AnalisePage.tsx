import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Printer, FileText, MessageSquare, ChevronDown, Smartphone, ArrowLeft, Zap, SlidersHorizontal } from "lucide-react";
import SendOrdersModal from "@/components/dashboard/SendOrdersModal";
import { generateScenarios, type Scenario } from "@/lib/scenarios";

type Fornecedor = Tables<"fornecedores">;

interface OrderItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  preco: number;
  total: number;
}

const AnalisePage = () => {
  const navigate = useNavigate();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [applyingScenario, setApplyingScenario] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [sendQueueOpen, setSendQueueOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [showOtherOptions, setShowOtherOptions] = useState(false);

  // Receipt dialog
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptFornecedor, setReceiptFornecedor] = useState<Fornecedor | null>(null);
  const [receiptItems, setReceiptItems] = useState<OrderItem[]>([]);
  const [receiptNumero, setReceiptNumero] = useState<number | null>(null);
  const [whatsappAiLoading, setWhatsappAiLoading] = useState<string | null>(null);

  // ---- Data fetching ----
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
      const { data, error } = await supabase.from("cotacao_fornecedores").select("fornecedor_id").eq("cotacao_id", cotacaoAtiva!.id);
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
      const { data, error } = await supabase.from("cotacao_produtos").select("*, produtos(*, categorias(nome))").eq("cotacao_id", cotacaoAtiva!.id);
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

  // ---- Compute totals ----
  const { grandTotal, avgTotal, economiaDisponivel } = useMemo(() => {
    let best = 0;
    let avg = 0;
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const prices = cpPrecos.map((p: any) => Number(p.preco));
      const qty = cp.quantidade || 1;
      best += Math.min(...prices) * qty;
      const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
      avg += mean * qty;
    });
    return { grandTotal: best, avgTotal: avg, economiaDisponivel: Math.max(0, avg - best) };
  }, [cotacaoProdutos, precos]);

  // ---- Orders by supplier (best price wins) ----
  const orders = useMemo(() => {
    const result: Record<string, OrderItem[]> = {};
    fornecedores.forEach((f) => { result[f.id] = []; });

    const winCount: Record<string, number> = {};
    fornecedores.forEach((f) => { winCount[f.id] = 0; });
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
      const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
      if (winners.length === 1) winCount[winners[0].fornecedor_id] = (winCount[winners[0].fornecedor_id] || 0) + 1;
    });

    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
      const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
      let best = winners[0];
      if (winners.length > 1) {
        winners.sort((a: any, b: any) => (winCount[b.fornecedor_id] || 0) - (winCount[a.fornecedor_id] || 0));
        best = winners[0];
      }
      const qt = cp.quantidade || 1;
      result[best.fornecedor_id]?.push({
        produto: cp.produtos?.nome || "?",
        embalagem: cp.produtos?.embalagem || "un",
        quantidade: qt,
        preco: best.preco ?? 0,
        total: (best.preco ?? 0) * qt,
      });
    });
    return result;
  }, [cotacaoProdutos, precos, fornecedores]);

  // ---- Auto-generate scenarios when data is ready ----
  const hasPrecos = precos.some((p: any) => p.preco !== null && p.preco > 0);

  useEffect(() => {
    if (hasPrecos && cotacaoProdutos.length > 0 && fornecedores.length > 0 && !scenarios) {
      try {
        const result = generateScenarios(cotacaoProdutos, precos, fornecedores);
        setScenarios(result);
      } catch (e) {
        console.error("Error generating scenarios:", e);
      }
    }
  }, [hasPrecos, cotacaoProdutos, precos, fornecedores, scenarios]);

  // ---- AUTO MODE: pick best scenario ----
  const scenarioEconomia = scenarios?.find(s => s.id === "sem-minimo-abaixo") || scenarios?.find(s => s.id === "melhor-preco");
  const scenarioMelhorPreco = scenarios?.find(s => s.id === "melhor-preco");
  const scenarioConsolidado = scenarios?.find(s => s.id === "consolidado");
  const melhorPrecoMinIssues = scenarioMelhorPreco?.fornecedores.filter(s => !s.minimoOk).length || 0;

  const autoDecision = useMemo(() => {
    if (!scenarioEconomia) return { scenario: null, warning: null, label: "" };

    let chosen = scenarioEconomia;
    let warning: string | null = null;

    // EXCEÇÃO 2: Menos fornecedores reduz ≥1 fornecedor com custo ≤5%
    if (scenarioConsolidado && scenarioEconomia) {
      const aumento = (scenarioConsolidado.totalGeral - scenarioEconomia.totalGeral) / scenarioEconomia.totalGeral;
      if (
        scenarioConsolidado.numFornecedores < scenarioEconomia.numFornecedores &&
        aumento <= 0.05
      ) {
        chosen = scenarioConsolidado;
      }
    }

    // EXCEÇÃO 1: Melhor preço é >10% mais barato
    if (scenarioMelhorPreco && scenarioEconomia && scenarioMelhorPreco.id !== scenarioEconomia.id) {
      const diff = (scenarioEconomia.totalGeral - scenarioMelhorPreco.totalGeral) / scenarioEconomia.totalGeral;
      if (diff > 0.10) {
        warning = "💰 Existe uma opção mais barata, mas alguns pedidos podem não atingir o mínimo.";
      }
    }

    return { scenario: chosen, warning, label: chosen.nome };
  }, [scenarioEconomia, scenarioMelhorPreco, scenarioConsolidado]);

  // ---- Apply selected scenario (create pedidos) ----
  const applyScenario = async (scenario: Scenario) => {
    if (!cotacaoAtiva?.id || !user?.id) return;
    setApplyingScenario(true);
    try {
      for (const sf of scenario.fornecedores) {
        const fId = sf.fornecedorId;
        const { data: existing } = await supabase.from("pedidos").select("id").eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", fId).limit(1).maybeSingle();
        if (existing) {
          await supabase.from("pedidos").update({ total: sf.total, status: "rascunho" as any }).eq("id", existing.id);
        } else {
          await supabase.from("pedidos").insert({ cotacao_id: cotacaoAtiva.id, fornecedor_id: fId, total: sf.total, created_by: user.id, loja_id: lojaAtiva?.id || null, status: "rascunho" as any });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setSelectedScenario(scenario);
      setOrdersOpen(true);
      toast.success("✅ Estratégia aplicada com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar cenário");
    } finally {
      setApplyingScenario(false);
    }
  };

  // Helper: get items for a supplier from selected scenario or default orders
  const getSupplierItems = (fId: string): OrderItem[] => {
    if (selectedScenario) {
      const sf = selectedScenario.fornecedores.find(s => s.fornecedorId === fId);
      return sf?.items || [];
    }
    return orders[fId] || [];
  };

  // ---- WhatsApp send ----
  const createPedidoMutation = useMutation({
    mutationFn: async ({ fornecedorId, total }: { fornecedorId: string; total: number }) => {
      if (!cotacaoAtiva) throw new Error("Sem cotação ativa");
      // Check if pedido already exists for this cotacao+fornecedor
      const { data: existing } = await supabase.from("pedidos").select("id")
        .eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", fornecedorId)
        .limit(1).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("pedidos").update({
          total, status: "enviado" as any, enviado_at: new Date().toISOString(),
        }).eq("id", existing.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("pedidos").insert({
        cotacao_id: cotacaoAtiva.id, fornecedor_id: fornecedorId, status: "enviado",
        total, enviado_at: new Date().toISOString(), created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
  });

  const sendWhatsApp = async (f: Fornecedor) => {
    const items = getSupplierItems(f.id);
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);
    let pedidoNumero: number | null = null;
    try {
      const pedido = await createPedidoMutation.mutateAsync({ fornecedorId: f.id, total });
      pedidoNumero = (pedido as any).numero || null;
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (e) { console.error(e); }
    const date = new Date().toLocaleDateString("pt-BR");
    const billingParts: string[] = [];
    if (lojaAtiva) {
      if (lojaAtiva.nome) billingParts.push(`🏪 *Loja:* ${lojaAtiva.nome}`);
      if ((lojaAtiva as any).razao_social) billingParts.push(`🏢 *Razão Social:* ${(lojaAtiva as any).razao_social}`);
      if ((lojaAtiva as any).cnpj) billingParts.push(`📄 *CNPJ:* ${(lojaAtiva as any).cnpj}`);
      if ((lojaAtiva as any).inscricao_estadual) billingParts.push(`📋 *IE:* ${(lojaAtiva as any).inscricao_estadual}`);
      if (lojaAtiva.endereco) billingParts.push(`📍 *Endereço:* ${lojaAtiva.endereco}`);
    }
    const billingBlock = billingParts.length > 0 ? `\n-----\n*DADOS PARA FATURAMENTO:*\n${billingParts.join("\n")}\n` : "";
    let msg = `📋 *PEDIDO DE COMPRA - COMPRA360*${pedidoNumero ? ` #${pedidoNumero}` : ""}\n-----\n📦 *Fornecedor:* ${f.nome}\n📅 *Data:* ${date}\n📝 *Itens:* ${items.length}${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}${billingBlock}\n-----\n`;
    items.forEach((it, i) => {
      msg += `\n*${i + 1}. ${it.produto}*\n    Embalagem: ${it.embalagem}\n    Qtd: ${it.quantidade}\n    Preço unit.: R$ ${formatNumber(it.preco)}\n    *Subtotal: R$ ${formatNumber(it.total)}*\n`;
    });
    msg += `\n-----\n💰 *TOTAL GERAL: ${formatBRL(total)}*${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}\n-----\n_Enviado via Compra360_`;
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const sendWhatsAppAi = async (f: Fornecedor) => {
    const items = getSupplierItems(f.id);
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);
    setWhatsappAiLoading(f.id);
    try {
      await createPedidoMutation.mutateAsync({ fornecedorId: f.id, total });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (e) { console.error(e); }
    try {
      const resp = await supabase.functions.invoke("ai-automacao", {
        body: { type: "whatsapp-message", fornecedor_id: f.id, cotacao_id: cotacaoAtiva?.id, loja_id: lojaAtiva?.id, items: items.map((it) => ({ ...it, preco: formatNumber(it.preco), total: it.total.toFixed(2) })) },
      });
      if (resp.error) throw new Error(resp.error.message);
      const msg = resp.data?.message || "";
      const phone = f.telefone?.replace(/\D/g, "");
      const url = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message || "Erro ao gerar mensagem IA"); }
    setWhatsappAiLoading(null);
  };

  const openReceipt = async (f: Fornecedor) => {
    const items = getSupplierItems(f.id);
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    let numero: number | null = null;
    if (cotacaoAtiva) {
      const { data } = await supabase.from("pedidos").select("numero").eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", f.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      numero = (data as any)?.numero || null;
    }
    setReceiptFornecedor(f);
    setReceiptItems(items);
    setReceiptNumero(numero);
    setReceiptOpen(true);
  };

  // ---- Active orders (from scenario or default) ----
  const activeOrders = useMemo(() => {
    if (selectedScenario) {
      return selectedScenario.fornecedores.map(sf => ({
        fornecedor: fornecedores.find(f => f.id === sf.fornecedorId) || { id: sf.fornecedorId, nome: sf.fornecedorNome } as Fornecedor,
        items: sf.items as OrderItem[],
        total: sf.total,
        minimoOk: sf.minimoOk,
      }));
    }
    return fornecedores.map(f => {
      const items = orders[f.id] || [];
      const total = items.reduce((s, it) => s + it.total, 0);
      return { fornecedor: f, items, total, minimoOk: !f.pedido_minimo || f.pedido_minimo <= 0 || total >= f.pedido_minimo };
    });
  }, [selectedScenario, orders, fornecedores]);

  const fornecedoresComPedido = activeOrders.filter(o => o.items.length > 0);
  const totalGeral = fornecedoresComPedido.reduce((s, o) => s + o.total, 0);

  if (!cotacaoAtiva) return <div className="p-5 py-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;

  if (!hasPrecos) return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
      </div>
      <div className="text-center py-10 text-muted-foreground text-sm">Nenhum preço recebido ainda. Aguarde os fornecedores responderem.</div>
    </div>
  );

  // ---- Render: Scenario Cards (used in manual mode and "ver outras opções") ----
  const renderScenarioCards = () => (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-sm font-bold text-foreground">
        {mode === "manual" ? "Compare e escolha como deseja comprar" : "Outras formas de comprar:"}
      </h3>

      {/* Card 1 — Economia Inteligente */}
      {scenarioEconomia && (
        <div className="bg-card border border-green-500/50 rounded-xl p-4 shadow-sm shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_0_16px_rgba(16,185,129,0.4)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.4)]">
              ✨ RECOMENDADO
            </span>
          </div>
          <div className="text-base font-bold text-foreground">Economia Inteligente</div>
          <div className="text-2xl font-extrabold font-mono text-foreground mt-1">{formatBRL(scenarioEconomia.totalGeral)}</div>
          {scenarioEconomia.diffVsBaseline !== 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {scenarioEconomia.diffVsBaseline > 0 ? "+" : ""}{formatBRL(scenarioEconomia.diffVsBaseline)} vs melhor preço puro
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">{scenarioEconomia.numFornecedores} fornecedor(es)</div>
          <p className="text-xs text-muted-foreground mt-2">Menor custo respeitando o pedido mínimo de cada fornecedor</p>
          <Button
            onClick={() => applyScenario(scenarioEconomia)}
            disabled={applyingScenario}
            className="w-full mt-3 h-12 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
          >
            {applyingScenario ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            ✅ Usar esta estratégia
          </Button>
        </div>
      )}

      {/* Card 2 — Melhor Preço */}
      {scenarioMelhorPreco && scenarioMelhorPreco.id !== scenarioEconomia?.id && (
        <div className="bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
              💰 MENOR CUSTO
            </span>
          </div>
          <div className="text-base font-bold text-foreground">Melhor Preço</div>
          <div className="text-xl font-extrabold font-mono text-foreground mt-1">{formatBRL(scenarioMelhorPreco.totalGeral)}</div>
          <p className="text-xs text-muted-foreground mt-2">Preço mais baixo possível — pode haver fornecedores abaixo do mínimo</p>
          {melhorPrecoMinIssues > 0 && (
            <div className="flex items-center gap-1.5 mt-2 bg-amber-500/10 rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                ⚠️ {melhorPrecoMinIssues} fornecedor(es) abaixo do pedido mínimo
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => applyScenario(scenarioMelhorPreco)}
            disabled={applyingScenario}
            className="w-full mt-3 h-12 text-sm font-bold"
          >
            {applyingScenario ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Usar esta estratégia
          </Button>
        </div>
      )}

      {/* Card 3 — Menos Fornecedores */}
      {scenarioConsolidado ? (
        <div className="bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
              📦 MAIS SIMPLES
            </span>
          </div>
          <div className="text-base font-bold text-foreground">Menos Fornecedores</div>
          <div className="text-xl font-extrabold font-mono text-foreground mt-1">{formatBRL(scenarioConsolidado.totalGeral)}</div>
          <div className="text-xs mt-1">
            <span className="font-bold text-green-600 dark:text-green-400">{scenarioConsolidado.numFornecedores}</span>
            <span className="text-muted-foreground"> fornecedor(es)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Menos pedidos para gerenciar, entrega mais simples</p>
          <Button
            variant="outline"
            onClick={() => applyScenario(scenarioConsolidado)}
            disabled={applyingScenario}
            className="w-full mt-3 h-12 text-sm font-bold"
          >
            {applyingScenario ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Usar esta estratégia
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-4 shadow-sm opacity-60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
              📦 MAIS SIMPLES
            </span>
          </div>
          <div className="text-base font-bold text-foreground">Menos Fornecedores</div>
          <p className="text-xs text-muted-foreground mt-3">
            Já atingimos o menor número possível de fornecedores nesta compra
          </p>
        </div>
      )}

      {/* Tabela Comparativa */}
      {scenarios && scenarios.length > 1 && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground">Estratégia</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">Forn.</th>
              </tr>
            </thead>
            <tbody>
              {scenarioEconomia && (
                <tr className="bg-green-500/5 border-l-2 border-l-green-500">
                  <td className="px-3 py-2 text-xs font-bold text-foreground">
                    Economia inteligente
                    <span className="ml-1 text-[9px] text-green-600 dark:text-green-400 font-bold">← recomendado</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono font-bold text-foreground">{formatBRL(scenarioEconomia.totalGeral)}</td>
                  <td className="px-3 py-2 text-center text-xs font-bold">{scenarioEconomia.numFornecedores}</td>
                </tr>
              )}
              {scenarioMelhorPreco && scenarioMelhorPreco.id !== scenarioEconomia?.id && (
                <tr>
                  <td className="px-3 py-2 text-xs font-medium text-foreground">
                    Melhor preço
                    <span className="ml-1 text-[9px] text-muted-foreground">(mais barato)</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono font-bold text-foreground">{formatBRL(scenarioMelhorPreco.totalGeral)}</td>
                  <td className="px-3 py-2 text-center text-xs font-bold">{scenarioMelhorPreco.numFornecedores}</td>
                </tr>
              )}
              {scenarioConsolidado && (
                <tr>
                  <td className="px-3 py-2 text-xs font-medium text-foreground">
                    Menos fornecedores
                    <span className="ml-1 text-[9px] text-muted-foreground">(mais simples)</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-mono font-bold text-foreground">{formatBRL(scenarioConsolidado.totalGeral)}</td>
                  <td className="px-3 py-2 text-center text-xs font-bold">{scenarioConsolidado.numFornecedores}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-5 space-y-5 pb-[calc(env(safe-area-inset-bottom,0px)+140px)]">
      {/* NAV */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
        <span className="text-xs text-muted-foreground">Análise de pedidos</span>
      </div>

      {/* 1. TOGGLE DE MODO */}
      {!selectedScenario && scenarios && scenarios.length > 0 && (
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-full bg-muted p-1 gap-1">
            <button
              onClick={() => { setMode("auto"); setShowOtherOptions(false); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                mode === "auto"
                  ? "bg-green-600 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-4 w-4" />
              Automático
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                mode === "manual"
                  ? "bg-muted-foreground/20 text-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Manual
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">💰 Total da compra</div>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {formatBRL(selectedScenario ? selectedScenario.totalGeral : (autoDecision.scenario ? autoDecision.scenario.totalGeral : grandTotal))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🏆 Economia vs média</div>
            <div className="text-xl font-extrabold font-mono text-green-600 dark:text-green-400 mt-1">
              {formatBRL(economiaDisponivel)}
            </div>
          </div>
        </div>
        <p className="text-center text-xs font-medium text-primary mt-3">
          {mode === "auto" ? "O Compra360 já escolheu a melhor opção para você" : "Compare e escolha como deseja comprar"}
        </p>
      </div>

      {/* 2. MODO AUTOMÁTICO — Card de decisão */}
      {mode === "auto" && !selectedScenario && autoDecision.scenario && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-card border border-green-500/50 rounded-xl p-5 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all">
            <div className="text-center mb-4">
              <span className="text-2xl">🏆</span>
              <h3 className="text-base font-bold text-foreground mt-1">Melhor escolha para você</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">💰 Total</span>
                <span className="text-xl font-extrabold font-mono text-foreground">{formatBRL(autoDecision.scenario.totalGeral)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">📦 Fornecedores</span>
                <span className="text-sm font-bold text-foreground">{autoDecision.scenario.numFornecedores}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">💸 Economia vs pior preço</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatBRL(worstTotal - autoDecision.scenario.totalGeral)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Essa opção equilibra menor custo com pedidos válidos.
            </p>

            {autoDecision.warning && (
              <div className="mt-3 bg-amber-500/10 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{autoDecision.warning}</p>
              </div>
            )}

            <Button
              onClick={() => applyScenario(autoDecision.scenario!)}
              disabled={applyingScenario}
              className="w-full mt-4 h-12 text-sm font-bold bg-green-600 hover:bg-green-700 text-white hover:scale-[1.02] transition-transform"
            >
              {applyingScenario ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              ✅ Aplicar automaticamente
            </Button>
          </div>

          {/* Botão "Ver outras opções" */}
          {scenarios && scenarios.length > 1 && (
            <>
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowOtherOptions(!showOtherOptions)}
              >
                {showOtherOptions ? "Ocultar outras opções ↑" : "Ver outras formas de comprar ↓"}
              </Button>
              {showOtherOptions && renderScenarioCards()}
            </>
          )}
        </div>
      )}

      {/* 3. MODO MANUAL — Cards de cenário */}
      {mode === "manual" && !selectedScenario && scenarios && scenarios.length > 0 && renderScenarioCards()}

      {/* Cenário aplicado */}
      {selectedScenario && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Estratégia "{selectedScenario.nome}" aplicada</div>
              <div className="text-xs text-muted-foreground">
                {selectedScenario.numFornecedores} fornecedor(es) · Total: {formatBRL(selectedScenario.totalGeral)}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setSelectedScenario(null); setOrdersOpen(false); }}>Trocar estratégia</Button>
        </div>
      )}

      {/* BLOCO EXPLICATIVO */}
      <div className="bg-muted/50 border rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground text-center">
          🤖 O sistema analisou {cotacaoProdutos.length} produto(s) e {fornecedores.length} fornecedor(es) para encontrar a combinação ideal de preço e operação.
        </p>
      </div>

      {/* PEDIDOS — accordion */}
      {fornecedoresComPedido.length > 0 && (
        <Collapsible open={ordersOpen} onOpenChange={setOrdersOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full bg-card border rounded-xl px-4 py-3 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              📋 Ver pedidos prontos
              <span className="text-xs font-normal text-muted-foreground">({fornecedoresComPedido.length})</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${ordersOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {fornecedoresComPedido.map(({ fornecedor: f, items, total, minimoOk }) => (
              <div key={f.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-green-600">✅</span>
                    <span className="font-bold text-foreground text-sm truncate">{f.nome}</span>
                    {!minimoOk && <span className="text-[10px] text-amber-600 dark:text-amber-400">⚠️ abaixo do mín.</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold font-mono text-foreground">{formatBRL(total)}</span>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => sendWhatsApp(f)}>
                      <Smartphone className="h-4 w-4 text-green-600" />
                    </Button>
                  </div>
                </div>
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50">
                      <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase text-muted-foreground">Produto</th>
                      <th className="px-3 py-1.5 text-center text-[10px] font-bold uppercase text-muted-foreground">Qt</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase text-muted-foreground">Preço</th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-bold uppercase text-muted-foreground">Subtotal</th>
                    </tr></thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="px-3 py-1.5 text-xs font-medium">{it.produto}</td>
                          <td className="px-3 py-1.5 text-center text-xs">{it.quantidade}</td>
                          <td className="px-3 py-1.5 text-right text-xs font-mono">R${formatNumber(it.preco)}</td>
                          <td className="px-3 py-1.5 text-right text-xs font-mono font-bold">{formatBRL(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t flex items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => openReceipt(f)}><FileText className="h-3 w-3 mr-1" /> Conferência</Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => sendWhatsAppAi(f)} disabled={whatsappAiLoading === f.id}>
                      {whatsappAiLoading === f.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MessageSquare className="h-3 w-3 mr-1" />} 🤖 IA
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">Total geral</span>
              <span className="text-lg font-extrabold font-mono text-foreground">{formatBRL(totalGeral)}</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* CTA FIXO */}
      {selectedScenario && fornecedoresComPedido.length > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+64px)] left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50">
          <Button
            onClick={() => setSendQueueOpen(true)}
            size="lg"
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-base font-bold"
          >
            <Smartphone className="h-5 w-5 mr-2" /> 📱 Enviar pedidos agora (já otimizado)
          </Button>
        </div>
      )}

      <SendOrdersModal open={sendQueueOpen} onOpenChange={setSendQueueOpen} orders={fornecedoresComPedido.map(o => ({ fornecedor: o.fornecedor, items: o.items, total: o.total }))} onSendOrder={(f) => sendWhatsApp(f)} onConclude={async () => {
        if (cotacaoAtiva?.id) {
          await supabase.from("cotacoes").update({ status: "finalizada", finalizada_at: new Date().toISOString() }).eq("id", cotacaoAtiva.id);
          queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
        }
        navigate("/dashboard");
      }} />

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-lg print:max-w-full print:shadow-none print:border-none">
          <DialogHeader className="print:hidden"><DialogTitle>📋 Ficha de Conferência</DialogTitle></DialogHeader>
          {receiptFornecedor && (
            <div className="space-y-4" id="receipt-content">
              <div className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-bold">FICHA DE CONFERÊNCIA</h2><p className="text-sm text-muted-foreground">Compra360</p></div>
                  {receiptNumero && <div className="text-right"><span className="text-xs text-muted-foreground">Pedido Nº</span><div className="text-2xl font-extrabold font-mono text-primary">#{receiptNumero}</div></div>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{receiptFornecedor.nome}</strong></div>
                  <div><span className="text-muted-foreground">Data:</span> <strong>{new Date().toLocaleDateString("pt-BR")}</strong></div>
                </div>
                {lojaAtiva && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Dados para Faturamento</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div><span className="text-muted-foreground">Loja:</span> {lojaAtiva.nome}</div>
                      {(lojaAtiva as any).cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {(lojaAtiva as any).cnpj}</div>}
                      {(lojaAtiva as any).razao_social && <div><span className="text-muted-foreground">Razão Social:</span> {(lojaAtiva as any).razao_social}</div>}
                      {(lojaAtiva as any).inscricao_estadual && <div><span className="text-muted-foreground">IE:</span> {(lojaAtiva as any).inscricao_estadual}</div>}
                      {lojaAtiva.endereco && <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {lojaAtiva.endereco}</div>}
                    </div>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-foreground/20">
                  <th className="py-1.5 text-left text-[10px] font-bold uppercase w-8">✓</th>
                  <th className="py-1.5 text-left text-[10px] font-bold uppercase">Produto</th>
                  <th className="py-1.5 text-center text-[10px] font-bold uppercase w-10">Qt</th>
                  <th className="py-1.5 text-right text-[10px] font-bold uppercase w-20">Preço</th>
                  <th className="py-1.5 text-right text-[10px] font-bold uppercase w-20">Subtotal</th>
                </tr></thead>
                <tbody>{receiptItems.map((it, i) => (
                  <tr key={i} className="border-b border-dashed">
                    <td className="py-2"><div className="w-4 h-4 border-2 border-foreground/40 rounded-sm" /></td>
                    <td className="py-2 font-medium text-xs">{it.produto}</td>
                    <td className="py-2 text-center text-xs font-bold">{it.quantidade}</td>
                    <td className="py-2 text-right text-xs font-mono">R${formatNumber(it.preco)}</td>
                    <td className="py-2 text-right text-xs font-mono font-bold">{formatBRL(it.total)}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr className="border-t-2 border-foreground/30">
                  <td colSpan={4} className="py-2 text-right font-bold">TOTAL:</td>
                  <td className="py-2 text-right font-mono font-extrabold text-lg">{formatBRL(receiptItems.reduce((s, it) => s + it.total, 0))}</td>
                </tr></tfoot>
              </table>
              <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-8">
                <div className="text-center"><div className="border-b border-foreground/30 mb-1 h-8" /><span className="text-xs text-muted-foreground">Conferido por</span></div>
                <div className="text-center"><div className="border-b border-foreground/30 mb-1 h-8" /><span className="text-xs text-muted-foreground">Data de recebimento</span></div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 print:hidden mt-2">
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>Fechar</Button>
            <Button onClick={() => window.print()} className="bg-primary"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnalisePage;
