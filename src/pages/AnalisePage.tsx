import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Zap, CheckCircle2, Printer, FileText, MessageSquare, ChevronDown, Smartphone, ArrowLeft } from "lucide-react";
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
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [applyingScenario, setApplyingScenario] = useState(false);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [sendQueueOpen, setSendQueueOpen] = useState(false);

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

  // ---- Compute current total (best price per product) ----
  const { grandTotal, worstTotal, economiaDisponivel, hasMinimumIssues } = useMemo(() => {
    let best = 0;
    let worst = 0;
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const prices = cpPrecos.map((p: any) => Number(p.preco));
      const qty = cp.quantidade || 1;
      best += Math.min(...prices) * qty;
      worst += Math.max(...prices) * qty;
    });
    // Check if any supplier with items is below minimum
    const supplierTotals: Record<string, number> = {};
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos
        .filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0)
        .sort((a: any, b: any) => a.preco - b.preco);
      if (!cpPrecos.length) return;
      const fId = cpPrecos[0].fornecedor_id;
      const qty = cp.quantidade || 1;
      supplierTotals[fId] = (supplierTotals[fId] || 0) + Number(cpPrecos[0].preco) * qty;
    });
    let hasMinIssue = false;
    for (const [fId, total] of Object.entries(supplierTotals)) {
      const f = fornecedores.find(ff => ff.id === fId);
      if (f?.pedido_minimo && Number(f.pedido_minimo) > 0 && total < Number(f.pedido_minimo)) {
        hasMinIssue = true;
        break;
      }
    }
    return { grandTotal: best, worstTotal: worst, economiaDisponivel: worst - best, hasMinimumIssues: hasMinIssue };
  }, [cotacaoProdutos, precos, fornecedores]);

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

  // ---- Generate Scenarios ----
  const runScenarios = () => {
    if (!cotacaoAtiva?.id) return;
    setScenarioLoading(true);
    try {
      const result = generateScenarios(cotacaoProdutos, precos, fornecedores);
      setScenarios(result);
      setSelectedScenario(null);
      toast.success(`${result.length} cenário(s) gerado(s) para comparação`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar cenários");
    } finally {
      setScenarioLoading(false);
    }
  };

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
      toast.success("Cenário aplicado! Pedidos criados. ✅");
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
    const url = phone ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
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
      const url = phone ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
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

  const toggleCard = (id: string) => setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));

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
  const fornecedoresSemPedido = activeOrders.filter(o => o.items.length === 0);
  const totalGeral = fornecedoresComPedido.reduce((s, o) => s + o.total, 0);

  if (!cotacaoAtiva) return <div className="p-5 py-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;

  const hasPrecos = precos.some((p: any) => p.preco !== null && p.preco > 0);

  return (
    <div className="p-5 space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
        <span className="text-xs text-muted-foreground">Análise de pedidos</span>
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">💰 Total da compra</div>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">{formatBRL(selectedScenario ? selectedScenario.totalGeral : grandTotal)}</div>
          </div>
          {economiaDisponivel > 0 && !selectedScenario && (
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">💸 Economia vs pior preço</div>
              <div className="text-lg font-extrabold font-mono text-green-600 dark:text-green-400 mt-1">{formatBRL(economiaDisponivel)}</div>
            </div>
          )}
        </div>
      </div>

      {hasPrecos && !selectedScenario && (
        <div className="bg-card border border-primary/20 rounded-xl p-5 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Zap className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-sm font-bold text-foreground">🤖 Simulação de cenários</div>
              <div className="text-xs text-muted-foreground">Compare diferentes estratégias de compra e escolha a melhor</div>
            </div>
          </div>
          <Button onClick={runScenarios} disabled={scenarioLoading} className="w-full" size="lg">
            {scenarioLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            {scenarioLoading ? "Calculando..." : scenarios ? "Recalcular cenários" : "Simular cenários"}
          </Button>
        </div>
      )}

      {scenarios && !selectedScenario && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-foreground">📊 Cenários disponíveis</h3>
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
                      <div>
                        <div className="text-[10px] text-muted-foreground">Total</div>
                        <div className="text-base font-extrabold font-mono text-foreground">{formatBRL(sc.totalGeral)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Fornecedores</div>
                        <div className="text-base font-bold text-foreground">{sc.numFornecedores}</div>
                      </div>
                      {sc.diffVsBaseline !== 0 && (
                        <div>
                          <div className="text-[10px] text-muted-foreground">Diferença</div>
                          <div className={`text-sm font-bold font-mono ${sc.diffVsBaseline > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {sc.diffVsBaseline > 0 ? "+" : ""}{formatBRL(sc.diffVsBaseline)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => applyScenario(sc)} disabled={applyingScenario} variant={isBaseline ? "default" : "outline"}>
                        {applyingScenario ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Aplicar este cenário
                      </Button>
                    </div>
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
              <div className="text-xs text-muted-foreground">
                {selectedScenario.numFornecedores} fornecedor(es) · Total: {formatBRL(selectedScenario.totalGeral)}
                {selectedScenario.diffVsBaseline > 0 && ` (+${formatBRL(selectedScenario.diffVsBaseline)} vs melhor preço)`}
              </div>
            </div>
          </div>
          {selectedScenario.semPreco > 0 && <div className="text-xs text-muted-foreground mt-2">{selectedScenario.semPreco} produto(s) sem cotação</div>}
          <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setSelectedScenario(null)}>Trocar cenário</Button>
        </div>
      )}

      {hasPrecos && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">{selectedScenario ? `Pedidos — ${selectedScenario.nome}` : "Pedidos (melhor preço por item)"}</h3>
          {fornecedoresComPedido.map(({ fornecedor: f, items, total, minimoOk }) => {
            const isOpen = openCards[f.id] || false;
            return (
              <div key={f.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleCard(f.id)}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-green-600">✅</span>
                    <span className="font-bold text-foreground text-sm truncate">{f.nome}</span>
                    {!minimoOk && <span className="text-[10px] text-amber-600 dark:text-amber-400">⚠️ abaixo do mín.</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-extrabold font-mono text-foreground">{formatBRL(total)}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); sendWhatsApp(f); }}><Smartphone className="h-4 w-4 text-green-600" /></Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
                {isOpen && (
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
                )}
              </div>
            );
          })}
          {fornecedoresSemPedido.map(({ fornecedor: f }) => (
            <div key={f.id} className="px-4 py-2.5 flex items-center gap-2 bg-card border rounded-xl opacity-50">
              <span className="text-amber-500">⚠️</span>
              <span className="text-sm text-muted-foreground">{f.nome} — não incluído nesta compra</span>
            </div>
          ))}
          {fornecedoresComPedido.length > 0 && (
            <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">Total geral</span>
              <span className="text-lg font-extrabold font-mono text-foreground">{formatBRL(totalGeral)}</span>
            </div>
          )}
        </div>
      )}

      {!hasPrecos && <div className="text-center py-10 text-muted-foreground text-sm">Nenhum preço recebido ainda. Aguarde os fornecedores responderem.</div>}

      {fornecedoresComPedido.length > 0 && (
        <Button onClick={() => setSendQueueOpen(true)} size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white text-base font-bold">
          <Smartphone className="h-5 w-5 mr-2" /> Finalizar e enviar pedidos
        </Button>
      )}

      <SendOrdersModal open={sendQueueOpen} onOpenChange={setSendQueueOpen} orders={fornecedoresComPedido.map(o => ({ fornecedor: o.fornecedor, items: o.items, total: o.total }))} onSendOrder={(f) => sendWhatsApp(f)} onConclude={() => navigate("/dashboard")} />

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
