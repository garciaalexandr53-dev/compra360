import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber, buildWhatsAppUrl } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Printer, FileText, MessageSquare, ChevronDown, Smartphone, ArrowLeft, Zap, SlidersHorizontal, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import NegociacaoModal from "@/components/analise/NegociacaoModal";
import CelebracaoScreen from "@/components/analise/CelebracaoScreen";
import SendOrdersModal from "@/components/dashboard/SendOrdersModal";
import { generateScenarios, analyzeGaps, type Scenario, type GapAnalysis } from "@/lib/scenarios";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";
import { Skeleton } from "@/components/ui/skeleton";

type Fornecedor = Tables<"fornecedores">;

interface OrderItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  fator: number;
  preco: number;
  total: number;
}

const AnalisePage = () => {
  const [progressValue, setProgressValue] = useState(0);
  const navigate = useNavigate();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkPlan, showPlanos, setShowPlanos } = useFeatureCheck();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [appliedScenarioId, setAppliedScenarioId] = useState<string | null>(null);
  const [applyingScenario, setApplyingScenario] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [sendQueueOpen, setSendQueueOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // Receipt dialog
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptFornecedor, setReceiptFornecedor] = useState<Fornecedor | null>(null);
  const [receiptItems, setReceiptItems] = useState<OrderItem[]>([]);
  const [receiptNumero, setReceiptNumero] = useState<number | null>(null);
  const [whatsappAiLoading, setWhatsappAiLoading] = useState<string | null>(null);
  const [negociacaoOpen, setNegociacaoOpen] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState("");
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [gapResolutions, setGapResolutions] = useState<Record<string, string>>({});
  const [applyingGap, setApplyingGap] = useState<string | null>(null);

  // Celebration screen
  const [showCelebracao, setShowCelebracao] = useState(false);
  const [celebracaoData, setCelebracaoData] = useState<{ name: string; total: number; economia: number; numForn: number } | null>(null);

  // AI explanation per scenario
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiExplanationLoading, setAiExplanationLoading] = useState<string | null>(null);

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
      const fator = cp.fator_embalagem || 1;
      best += Math.min(...prices) * qty * fator;
      const mean = prices.reduce((s: number, v: number) => s + v, 0) / prices.length;
      avg += mean * qty * fator;
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
      const fator = cp.fator_embalagem || 1;
      result[best.fornecedor_id]?.push({
        produto: cp.produtos?.nome || "?",
        embalagem: cp.produtos?.embalagem || "un",
        quantidade: qt,
        fator,
        preco: best.preco ?? 0,
        total: (best.preco ?? 0) * qt * fator,
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

  // Animate progress bar on load
  useEffect(() => {
    if (hasPrecos && scenarios) {
      const t = setTimeout(() => setProgressValue(100), 100);
      return () => clearTimeout(t);
    }
  }, [hasPrecos, scenarios]);

  // ---- AUTO MODE: pick best scenario ----
  const scenarioEconomia = scenarios?.find(s => s.id === "sem-minimo-abaixo") || scenarios?.find(s => s.id === "melhor-preco");
  const scenarioMelhorPreco = scenarios?.find(s => s.id === "melhor-preco");
  const scenarioConsolidado = scenarios?.find(s => s.id === "consolidado");
  const melhorPrecoMinIssues = scenarioMelhorPreco?.fornecedores.filter(s => !s.minimoOk).length || 0;

  const autoDecision = useMemo(() => {
    if (!scenarioEconomia && !scenarioMelhorPreco) return { scenario: null, warning: null, label: "" };

    let chosen = scenarioEconomia || scenarioMelhorPreco!;
    let warning: string | null = null;

    if (scenarioConsolidado && scenarioEconomia) {
      const aumento = (scenarioConsolidado.totalGeral - scenarioEconomia.totalGeral) / scenarioEconomia.totalGeral;
      const consolidadoAbaixo = scenarioConsolidado.fornecedores.filter(f => !f.minimoOk).length;
      const economiaAbaixo = scenarioEconomia.fornecedores.filter(f => !f.minimoOk).length;
      if (
        scenarioConsolidado.numFornecedores < scenarioEconomia.numFornecedores &&
        aumento <= 0.05 &&
        consolidadoAbaixo <= economiaAbaixo
      ) {
        chosen = scenarioConsolidado;
      }
    }

    const aindaAbaixo = chosen.fornecedores.filter(f => !f.minimoOk);
    if (aindaAbaixo.length > 0) {
      warning = `⚠️ ${aindaAbaixo.length} fornecedor(es) ainda abaixo do pedido mínimo — esses itens não têm alternativa de preço.`;
    } else if (scenarioMelhorPreco && scenarioEconomia && scenarioMelhorPreco.id !== scenarioEconomia.id) {
      const diff = (scenarioEconomia.totalGeral - scenarioMelhorPreco.totalGeral) / scenarioEconomia.totalGeral;
      if (diff > 0.10) {
        warning = "💰 Existe uma opção mais barata, mas alguns pedidos podem não atingir o mínimo.";
      }
    }

    return { scenario: chosen, warning, label: chosen.nome };
  }, [scenarioEconomia, scenarioMelhorPreco, scenarioConsolidado]);

  // ---- Gap analysis ----
  const scenarioAtivo = selectedScenario ?? autoDecision.scenario;
  const gapAnalyses = useMemo(() => {
    if (!scenarioAtivo) return [];
    return analyzeGaps(scenarioAtivo, cotacaoProdutos, precos, fornecedores);
  }, [scenarioAtivo, cotacaoProdutos, precos, fornecedores]);

  // ---- Apply selected scenario (create pedidos) ----
  const applyScenario = async (scenario: Scenario) => {
    if (!cotacaoAtiva?.id || !user?.id) return;

    const abaixo = scenario.fornecedores.filter(s => !s.minimoOk);
    if (abaixo.length > 0) {
      const nomes = abaixo.map(s => `${s.fornecedorNome} (${formatBRL(s.total)} de ${formatBRL(s.pedidoMinimo)})`).join(", ");
      const continuar = confirm(
        `⚠️ Atenção: ${abaixo.length} fornecedor(es) abaixo do pedido mínimo:\n\n${nomes}\n\nDeseja aplicar mesmo assim?`
      );
      if (!continuar) return;
    }

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
      setAppliedScenarioId(scenario.id);
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
      const fatorLabel = it.fator > 1 ? ` c/${it.fator} un` : "";
      msg += `\n*${i + 1}. ${it.produto}*\n    Embalagem: ${it.embalagem}${fatorLabel}\n    Qtd: ${it.quantidade}${it.fator > 1 ? ` (${it.quantidade * it.fator} un)` : ""}\n    Preço unit.: R$ ${formatNumber(it.preco)}\n    *Subtotal: R$ ${formatNumber(it.total)}*\n`;
    });
    msg += `\n-----\n💰 *TOTAL GERAL: ${formatBRL(total)}*${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}\n-----\n_Enviado via Compra360_`;
    window.open(buildWhatsAppUrl(f.telefone, msg), "_blank");
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
      window.open(buildWhatsAppUrl(f.telefone, msg), "_blank");
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

  // ---- Gap handlers ----
  const applyGapAjuste = async (gap: GapAnalysis) => {
    if (!gap.ajuste?.viavel || !cotacaoAtiva?.id) return;
    setApplyingGap(gap.fornecedorId);
    try {
      for (const item of gap.ajuste.itens) {
        if (item.qtdExtra <= 0) continue;
        await supabase
          .from("cotacao_produtos")
          .update({ quantidade: item.qtdSugerida })
          .eq("id", item.cpId);
      }
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
      setScenarios(null);
      setGapResolutions(prev => ({ ...prev, [gap.fornecedorId]: "done" }));
      toast.success(`✅ Quantidades ajustadas! ${gap.fornecedorNome} agora atinge o pedido mínimo.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao ajustar quantidades");
    }
    setApplyingGap(null);
  };

  const openGapNegociacao = (gap: GapAnalysis, f: Fornecedor) => {
    const comprador = lojaAtiva?.nome || "Compra360";
    const vendedor = f.representante || f.nome;
    const msg = `Olá ${vendedor}! Aqui é o comprador da ${comprador}.\n\nEstou fechando um pedido com vocês no Compra360. O valor total ficou em *${formatBRL(gap.valorAtual)}*, um pouco abaixo do mínimo de *${formatBRL(gap.pedidoMinimo)}* (faltam apenas ${formatBRL(gap.gap)}).\n\nConsegue liberar o faturamento dessa vez para fecharmos agora? Se preferir, podemos ajustar algum item. No aguardo! 🙏`;
    window.open(buildWhatsAppUrl(f.telefone, msg), "_blank");
    setGapResolutions(prev => ({ ...prev, [gap.fornecedorId]: "negociar" }));
  };

  const openRemanejar = (gap: GapAnalysis) => {
    const backlog = JSON.parse(localStorage.getItem("compra360_backlog") || "[]");
    const scenarioForn = scenarioAtivo?.fornecedores.find(
      sf => sf.fornecedorId === gap.fornecedorId
    );
    const fonte = gap.ajuste?.itens || scenarioForn?.items.map(i => ({
      cpId: i.cpId,
      produto: i.produto,
    })) || [];
    const novos = fonte.map((i: any) => ({
      cpId: i.cpId,
      produto: i.produto,
      fornecedorNome: gap.fornecedorNome,
      valorAtual: gap.valorAtual,
      pedidoMinimo: gap.pedidoMinimo,
      savedAt: new Date().toISOString(),
    }));
    if (novos.length > 0) {
      localStorage.setItem("compra360_backlog", JSON.stringify([...backlog, ...novos]));
    }
    setGapResolutions(prev => ({ ...prev, [gap.fornecedorId]: "remanejar" }));
    toast.success(`📁 ${novos.length} ite${novos.length === 1 ? "m salvo" : "ns salvos"} para a próxima cotação.`);
  };

  const runAiDistribution = async () => {
    if (!cotacaoAtiva?.id) return;
    if (!checkPlan("business", "Análise inteligente por IA")) return;
    setAiAnalysisText("");
    setAiAnalysisLoading(true);
    setAiAnalysisOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-distribuicao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro na análise de distribuição");
        setAiAnalysisLoading(false);
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
            if (content) { fullText += content; setAiAnalysisText(fullText); }
          } catch { /* partial */ }
        }
      }
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullText += content; setAiAnalysisText(fullText); }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na análise");
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  // ---- AI Explanation for a scenario ----
  const fetchAiExplanation = async (scenario: Scenario) => {
    if (aiExplanations[scenario.id]) return; // already loaded
    if (!checkPlan("business", "Explicação IA")) return;
    setAiExplanationLoading(scenario.id);
    try {
      const otherScenarios = (scenarios || []).filter(s => s.id !== scenario.id);
      const comparisons = otherScenarios.map(s => `${s.nome}: ${formatBRL(s.totalGeral)} com ${s.numFornecedores} fornecedores`).join("; ");
      const minIssues = scenario.fornecedores.filter(f => !f.minimoOk);
      const minAlert = minIssues.length > 0 ? `${minIssues.length} fornecedor(es) abaixo do pedido mínimo` : "Todos os fornecedores atingem o pedido mínimo";

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-cotacao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            messages: [{
              role: "user",
              content: `Explique em português por que a estratégia "${scenario.nome}" faz sentido nesta compra.

Dados: Total: ${formatBRL(scenario.totalGeral)}, ${scenario.numFornecedores} fornecedores, ${cotacaoProdutos.length} produtos. Comparação: ${comparisons || "Única opção disponível"}. Status mínimos: ${minAlert}.

REGRAS DE LINGUAGEM:
- Responda em linguagem simples e direta, como se estivesse explicando para um comprador de supermercado que não tem conhecimento técnico.
- Evite palavras como "burocrático", "ínfima", "conformidade", "operacional", "otimização".
- Use frases curtas. Fale sobre economia em reais, número de entregas, facilidade no dia a dia.
- Máximo 3 linhas no parágrafo explicativo.
- Depois do parágrafo, pule uma linha e escreva exatamente 3 bullet points, cada um em sua própria linha, começando com ✅ ou ⚠️.
- Não use markdown headers (#). Não misture bullet points dentro do texto.

Exemplo de tom:
"Com essa opção você gasta quase o mesmo valor, mas recebe de 2 fornecedores a menos. Isso significa menos entregas para conferir e menos notas para lançar no sistema."

✅ Primeiro destaque
✅ Segundo destaque
⚠️ Terceiro destaque`
            }],
          }),
        }
      );
      if (!resp.ok) throw new Error("Erro ao buscar explicação");
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
            if (content) {
              fullText += content;
              setAiExplanations(prev => ({ ...prev, [scenario.id]: fullText }));
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      setAiExplanations(prev => ({ ...prev, [scenario.id]: "Não foi possível gerar a explicação. Tente novamente." }));
    } finally {
      setAiExplanationLoading(null);
    }
  };

  const toggleExplanation = (scenarioId: string, scenario: Scenario) => {
    if (expandedExplanation === scenarioId) {
      setExpandedExplanation(null);
    } else {
      setExpandedExplanation(scenarioId);
      fetchAiExplanation(scenario);
    }
  };

  // ---- Determine which scenario is "selected" for display ----
  const activeScenarioId = selectedScenario?.id ?? (mode === "auto" ? autoDecision.scenario?.id : null);

  // ---- Empty states ----
  if (!cotacaoAtiva) {
    return (
      <div className="p-5 py-16 text-center space-y-4">
        <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhuma cotação ativa para analisar.</p>
        <p className="text-xs text-muted-foreground/70">Crie uma cotação no Painel e aguarde os fornecedores responderem.</p>
        <Button variant="default" size="sm" onClick={() => navigate("/dashboard")}>Ir para o Painel</Button>
      </div>
    );
  }

  if (!hasPrecos) return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
      </div>
      <div className="text-center py-10 text-muted-foreground text-sm">Nenhum preço recebido ainda. Aguarde os fornecedores responderem.</div>
    </div>
  );

  // ---- Build scenario list for cards ----
  const scenarioEconInteligente = scenarios?.find(s => s.id === "sem-minimo-abaixo");
  const recommendedId = scenarioEconomia?.id;
  
  const allScenarioCards: { scenario: Scenario; badge: string; badgeColor: string; badgeBg: string; displayName: string }[] = [];
  
  // Always show Melhor Preço
  if (scenarioMelhorPreco) {
    allScenarioCards.push({
      scenario: scenarioMelhorPreco,
      badge: recommendedId === scenarioMelhorPreco.id ? "🏆 MELHOR ESCOLHA" : "💰 MENOR CUSTO",
      badgeColor: recommendedId === scenarioMelhorPreco.id ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400",
      badgeBg: recommendedId === scenarioMelhorPreco.id ? "bg-green-100 dark:bg-green-950/40" : "bg-amber-100 dark:bg-amber-950/40",
      displayName: "Melhor Preço",
    });
  }
  // Show Economia Inteligente when it exists
  if (scenarioEconInteligente) {
    allScenarioCards.push({
      scenario: scenarioEconInteligente,
      badge: recommendedId === scenarioEconInteligente.id ? "🏆 MELHOR ESCOLHA" : "⚡ RECOMENDADO",
      badgeColor: recommendedId === scenarioEconInteligente.id ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400",
      badgeBg: recommendedId === scenarioEconInteligente.id ? "bg-green-100 dark:bg-green-950/40" : "bg-blue-100 dark:bg-blue-950/40",
      displayName: "Economia Inteligente",
    });
  }
  // Show Consolidado / Menos Fornecedores
  if (scenarioConsolidado) {
    allScenarioCards.push({
      scenario: scenarioConsolidado,
      badge: recommendedId === scenarioConsolidado.id ? "🏆 MELHOR ESCOLHA" : "📦 MAIS SIMPLES",
      badgeColor: recommendedId === scenarioConsolidado.id ? "text-green-700 dark:text-green-400" : "text-violet-700 dark:text-violet-400",
      badgeBg: recommendedId === scenarioConsolidado.id ? "bg-green-100 dark:bg-green-950/40" : "bg-violet-100 dark:bg-violet-950/40",
      displayName: "Menos Fornecedores",
    });
  }
  
  // Sort: recommended first
  allScenarioCards.sort((a, b) => {
    if (a.scenario.id === recommendedId) return -1;
    if (b.scenario.id === recommendedId) return 1;
    return 0;
  });
  // Auto-select first if none selected
  const effectiveSelectedId = activeScenarioId || allScenarioCards[0]?.scenario.id;

  // ---- RENDER ----
  return (
    <div className="pb-[calc(env(safe-area-inset-bottom,0px)+140px)]">
      {/* 1. HEADER (sticky) */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b px-4 py-3">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 -ml-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <span className="flex-1 text-center text-sm font-bold text-foreground">Análise de pedidos</span>
          <div className="w-20" /> {/* spacer */}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. TOGGLE */}
        {!selectedScenario && scenarios && scenarios.length > 0 && (
          <div className="flex items-center justify-center">
            <div className="inline-flex rounded-full bg-muted p-1 gap-1">
              <button
                onClick={() => setMode("auto")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  mode === "auto"
                    ? "bg-green-600 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-4 w-4" /> Automático
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  mode === "manual"
                    ? "bg-muted-foreground/20 text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" /> Manual
              </button>
            </div>
          </div>
        )}

        {/* 3. CARD DE TOTAIS */}
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">💰 Total da compra</div>
              <div className="text-2xl font-extrabold font-mono text-foreground mt-0.5">
                {formatBRL(selectedScenario ? selectedScenario.totalGeral : (autoDecision.scenario ? autoDecision.scenario.totalGeral : grandTotal))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🏆 Economia vs média</div>
              <div className="text-xl font-extrabold font-mono text-green-600 dark:text-green-400 mt-0.5">
                {formatBRL(economiaDisponivel)}
              </div>
            </div>
          </div>
        </div>

        {/* 4. BARRA DE PROGRESSO */}
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-[1200ms] ease-out"
              style={{
                width: `${progressValue}%`,
                backgroundColor: progressValue >= 100 ? "#16a34a" : "hsl(var(--primary))",
              }}
            />
          </div>
          {progressValue >= 100 && (
            <p className="text-[10px] text-muted-foreground text-right">Análise concluída ✓</p>
          )}
        </div>

        {/* 5. BANNER DO SISTEMA */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
            🤖 O sistema analisou <strong>{cotacaoProdutos.length} produto(s)</strong> e <strong>{fornecedores.length} fornecedor(es)</strong> para encontrar a combinação ideal de preço e operação.
          </p>
        </div>

        {/* 6. TÍTULO DA SEÇÃO */}
        <div>
          <h2 className="text-base font-bold text-foreground">Escolha sua estratégia de compra:</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Toque em cada opção para entender antes de decidir</p>
        </div>

        {/* 7. CARDS DE ESTRATÉGIA */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allScenarioCards.map(({ scenario, badge, badgeColor, badgeBg, displayName }) => {
            const isSelected = effectiveSelectedId === scenario.id;
            const isApplied = appliedScenarioId === scenario.id;
            const isExpanded = expandedExplanation === scenario.id;
            const minIssues = scenario.fornecedores.filter(f => !f.minimoOk);
            const economiaVsMedia = Math.max(0, avgTotal - scenario.totalGeral);

            return (
              <div
                key={scenario.id}
                className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${
                  isSelected
                    ? "border-green-500 shadow-[0_0_12px_rgba(22,163,74,0.15)]"
                    : "hover:shadow-md"
                }`}
              >
                {/* CAMADA A — Cabeçalho clicável */}
                <button
                  className="w-full text-left p-4 transition-colors hover:bg-muted/30"
                  onClick={() => {
                    setSelectedScenario(scenario);
                    setAppliedScenarioId(null);
                    if (mode === "auto") {
                      setMode("manual");
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeBg} ${badgeColor}`}>
                      {badge}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40 px-2 py-0.5 rounded-full">
                        ✓ SELECIONADO
                      </span>
                    )}
                  </div>
                  <div className="text-base font-bold text-foreground">{displayName}</div>
                  <div className="text-2xl font-extrabold font-mono text-foreground mt-1">{formatBRL(scenario.totalGeral)}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>{scenario.numFornecedores} fornecedor(es)</span>
                    <span className="text-muted-foreground/40">|</span>
                    {economiaVsMedia > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        economia {formatBRL(economiaVsMedia)}
                      </span>
                    )}
                    {minIssues.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ {minIssues.length} abaixo do mín.
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* CAMADA B — "Por que essa estratégia?" */}
                <div className="border-t bg-muted/20">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleExplanation(scenario.id, scenario)}
                  >
                    <span>🤖 Por que essa estratégia?</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 animate-in slide-in-from-top-1 duration-200">
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        {aiExplanationLoading === scenario.id && !aiExplanations[scenario.id] ? (
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                            <Skeleton className="h-3 w-3/5" />
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none dark:prose-invert text-xs text-green-900 dark:text-green-200 [&_p]:mb-3 [&_ul]:mt-2 [&_ul]:mb-1 [&_ul]:space-y-1.5 [&_li]:my-0 [&_li]:leading-relaxed whitespace-pre-line">
                            <ReactMarkdown>{aiExplanations[scenario.id] || ""}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* CAMADA C — Botão de ação (apenas no selecionado) */}
                {isSelected && (
                  <div className="px-4 pb-4 pt-1">
                    {isApplied ? (
                      <div className="w-full h-12 rounded-lg bg-green-100 dark:bg-green-950/30 border border-green-300 dark:border-green-700 flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">✅ Estratégia aplicada!</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => applyScenario(scenario)}
                        disabled={applyingScenario}
                        className="w-full h-12 text-sm font-bold bg-green-600 hover:bg-green-700 text-white"
                      >
                        {applyingScenario ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {mode === "auto" ? "✅ Aplicar automaticamente" : "✅ Usar esta estratégia"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          </div>

          {/* Disabled consolidated card if not available */}
          {!scenarioConsolidado && (
            <div className="bg-card border rounded-xl p-4 shadow-sm opacity-50">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full">
                📦 MAIS SIMPLES
              </span>
              <div className="text-base font-bold text-foreground mt-2">Menos Fornecedores</div>
              <p className="text-xs text-muted-foreground mt-2">
                Já atingimos o menor número possível de fornecedores nesta compra
              </p>
            </div>
          )}
        </div>

        {/* ── PAINEL DE OPORTUNIDADES ── */}
        {gapAnalyses.length > 0 && (
          <div className="space-y-3 animate-fade-in bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 shadow-sm shadow-orange-200/50 dark:shadow-orange-900/30">
            <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 border border-orange-100 dark:border-orange-900/40">
              <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                ⚡ <span className="font-bold">Dica do Concierge:</span> {user?.email?.split("@")[0] || "Alexandre"}, identifiquei fornecedores excelentes que não atingiram o mínimo. Recomendo o <span className="font-bold">Ajuste Inteligente</span> nos itens com maior desconto para liberarmos esses pedidos agora.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground">⚡ Oportunidades</h3>
                <p className="text-[10px] text-muted-foreground">Fornecedores próximos do mínimo — cenário: {scenarioAtivo?.nome || "ativo"}</p>
              </div>
            </div>

            {gapAnalyses.map((gap) => {
              const fornecedor = fornecedores.find(f => f.id === gap.fornecedorId);
              const resolution = gapResolutions[gap.fornecedorId];
              const isDone = resolution === "done";

              const barColor =
                gap.percentual >= 85 ? "bg-orange-400" :
                gap.percentual >= 60 ? "bg-amber-400" : "bg-gray-400";
              const barBg =
                gap.percentual >= 85 ? "bg-orange-100 dark:bg-orange-950/30" :
                gap.percentual >= 60 ? "bg-amber-100 dark:bg-amber-950/30" : "bg-gray-100 dark:bg-gray-800";
              const borderColor =
                gap.percentual >= 85 ? "border-orange-300 dark:border-orange-800" :
                gap.percentual >= 60 ? "border-amber-300 dark:border-amber-800" : "border-gray-200 dark:border-gray-700";

              return (
                <div key={gap.fornecedorId} className={`bg-card border rounded-xl p-4 shadow-sm transition-all duration-500 ${
                    isDone
                      ? "border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-950/20 shadow-green-100 dark:shadow-green-950/30"
                      : borderColor
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{gap.fornecedorNome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(() => {
                          const count = gap.ajuste?.itens.length ||
                            scenarioAtivo?.fornecedores.find(sf => sf.fornecedorId === gap.fornecedorId)?.items.length || 0;
                          return `Melhor preço em ${count} ite${count === 1 ? "m" : "ns"}`;
                        })()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      gap.percentual >= 85 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" :
                      gap.percentual >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {gap.percentual >= 85 ? "⚡ Quase lá!" : gap.percentual >= 60 ? "🤝 Negociar" : "📁 Remanejar"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-foreground">{formatBRL(gap.valorAtual)}</span>
                      <span className="text-muted-foreground">{formatBRL(gap.pedidoMinimo)} mínimo</span>
                    </div>
                    <div className={`h-2.5 rounded-full ${barBg} overflow-hidden`}>
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isDone
                            ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                            : `${barColor} ${gap.percentual >= 85 ? "animate-pulse" : ""}`
                        }`}
                        style={{ width: isDone ? "100%" : `${Math.min(gap.percentual, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{gap.percentual}% atingido</span>
                      <span className={isDone ? "text-green-600 dark:text-green-400 font-bold" : "font-medium text-foreground"}>
                        {isDone ? "✅ Mínimo atingido!" : `Faltam ${formatBRL(gap.gap)}`}
                      </span>
                    </div>
                  </div>

                  {gap.estrategia === "ajuste" && gap.ajuste?.viavel && !isDone && (
                    <div className="mt-3 space-y-1.5 bg-muted/40 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-foreground">📦 Sugestão de ajuste:</p>
                      {gap.ajuste.itens.filter(i => i.qtdExtra > 0).slice(0, 3).map(item => (
                        <div key={item.cpId} className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground truncate mr-2">{item.produto}</span>
                          <span className="text-green-600 dark:text-green-400 font-bold shrink-0">+{item.qtdExtra}un</span>
                        </div>
                      ))}
                      {gap.ajuste.economiaVsAlternativa > 0 && (
                        <div className="text-[10px] text-green-600 dark:text-green-400 font-medium pt-1 border-t border-border/50">
                          💰 Economia vs alternativa: {formatBRL(gap.ajuste.economiaVsAlternativa)}
                        </div>
                      )}
                    </div>
                  )}

                  {!isDone && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => applyGapAjuste(gap)}
                        disabled={gap.estrategia !== "ajuste" || !gap.ajuste?.viavel || !!applyingGap}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                          gap.estrategia === "ajuste" && gap.ajuste?.viavel
                            ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                        }`}
                      >
                        {applyingGap === gap.fornecedorId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : <span>🚀</span>}
                        Ajuste
                      </button>

                      <button
                        onClick={() => openRemanejar(gap)}
                        disabled={!!applyingGap}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-[11px] font-semibold bg-muted text-muted-foreground transition-all ${!!applyingGap ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/80"}`}
                      >
                        <span>📁</span>
                        Remanejar
                      </button>
                    </div>
                  )}

                  {isDone && (
                    <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="text-base">✅</span>
                      <span className="text-xs font-bold text-green-700 dark:text-green-400">Pedido mínimo atingido! Pronto para enviar.</span>
                    </div>
                  )}
                  {resolution === "negociar" && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">🤝 WhatsApp aberto — aguardando resposta do fornecedor</p>
                    </div>
                  )}
                  {resolution === "remanejar" && (
                    <div className="mt-2 bg-muted/60 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground font-medium">📁 Itens salvos para a próxima cotação</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 8. PEDIDOS — accordion */}
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
                      {!minimoOk && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">⚠️ mín.</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-extrabold font-mono text-foreground">{formatBRL(total)}</span>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => sendWhatsApp(f)}>
                        <Smartphone className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                  </div>
                  {!minimoOk && (
                    <div className="flex items-center gap-1.5 mx-4 mb-2 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <span className="text-amber-600 text-xs">⚠️</span>
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        Abaixo do mínimo: {formatBRL(total)} de {formatBRL(f.pedido_minimo || 0)}
                        {" "}(falta {formatBRL((f.pedido_minimo || 0) - total)})
                      </span>
                    </div>
                  )}
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
                            <td className="px-3 py-1.5 text-center text-xs">
                              {(it as any).quantidadeOriginal ? (
                                <span className="text-green-600 dark:text-green-400 font-bold" title={`Original: ${(it as any).quantidadeOriginal} → Ajustado: ${it.quantidade}`}>
                                  {it.quantidade}
                                  <span className="text-[9px] ml-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1 rounded">
                                    +{it.quantidade - (it as any).quantidadeOriginal}
                                  </span>
                                </span>
                              ) : it.quantidade}
                            </td>
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
      </div>

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

      {/* AI Distribution Analysis Dialog */}
      <Dialog open={aiAnalysisOpen} onOpenChange={setAiAnalysisOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análise Inteligente
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            {aiAnalysisLoading && !aiAnalysisText && (
              <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Analisando distribuição com IA...</span>
              </div>
            )}
            {aiAnalysisText && (
              <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_table]:text-xs">
                <ReactMarkdown>{aiAnalysisText}</ReactMarkdown>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t shrink-0">
            <Button variant="outline" size="sm" onClick={() => setAiAnalysisOpen(false)}>Fechar</Button>
            <div className="flex gap-2">
              {autoDecision.scenario && !aiAnalysisLoading && aiAnalysisText && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setAiAnalysisOpen(false);
                    if (autoDecision.scenario) applyScenario(autoDecision.scenario);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aplicar distribuição
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={runAiDistribution} disabled={aiAnalysisLoading} className="gap-1.5">
                {aiAnalysisLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reanalisar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NegociacaoModal
        open={negociacaoOpen}
        onOpenChange={setNegociacaoOpen}
        cotacaoId={cotacaoAtiva?.id || null}
        fornecedores={fornecedores}
      />
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </div>
  );
};

export default AnalisePage;
