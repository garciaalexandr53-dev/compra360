import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, FileSpreadsheet, Pencil, Send, Users, Eye, Trophy, RefreshCw, Smartphone, CheckCircle2, Clock, Target, Lightbulb, MessageCircle, X, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

import DashboardAlerts from "@/components/dashboard/DashboardAlerts";
import DashboardProgress from "@/components/dashboard/DashboardProgress";
import DashboardHistorico from "@/components/dashboard/DashboardHistorico";
import SendQueueModal from "@/components/dashboard/SendQueueModal";
import ConclusaoScreen from "@/components/dashboard/ConclusaoScreen";
import ImportErpModal from "@/components/ImportErpModal";
import ModalFornecedores from "@/components/cotacao/ModalFornecedores";
import ModalFornecedorSugestao from "@/components/cotacao/ModalFornecedorSugestao";
import ModalNovaCotacao from "@/components/cotacao/ModalNovaCotacao";

type Fornecedor = Tables<"fornecedores">;

const DashboardPage = () => {
  const { lojaAtiva } = useLojaAtiva();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [erpImportOpen, setErpImportOpen] = useState(false);
  const [sendQueueOpen, setSendQueueOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [fornSuggestOpen, setFornSuggestOpen] = useState(false);
  const [fornSuggestText, setFornSuggestText] = useState("");
  const [fornSuggestLoading, setFornSuggestLoading] = useState(false);
  const [fornSuggestHasHistory, setFornSuggestHasHistory] = useState(false);
  const [fornSuggestRecommendedIds, setFornSuggestRecommendedIds] = useState<string[]>([]);
  const [showConclusao, setShowConclusao] = useState(false);
  const [cotacaoRevisada, setCotacaoRevisada] = useState(false);
  const [sendCompleted, setSendCompleted] = useState(false);
  const [novaCotacaoOpen, setNovaCotacaoOpen] = useState(false);
  const [novaCotacaoOpt, setNovaCotacaoOpt] = useState<"manter" | "manter_precos" | "zerar" | null>(null);
  const [novaCotacaoLoading, setNovaCotacaoLoading] = useState(false);
  const [removeSupplier, setRemoveSupplier] = useState<Fornecedor | null>(null);

  const removeSupplierMutation = useMutation({
    mutationFn: async (fornecedorId: string) => {
      if (!cotacaoAtiva?.id) return;
      // Only remove from cotacao_fornecedores — prices are preserved for re-addition
      const { error } = await supabase
        .from("cotacao_fornecedores")
        .delete()
        .eq("cotacao_id", cotacaoAtiva.id)
        .eq("fornecedor_id", fornecedorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${removeSupplier?.nome} removido da cotação`);
      setRemoveSupplier(null);
      queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
      queryClient.invalidateQueries({ queryKey: ["dash-respondidos"] });
      queryClient.invalidateQueries({ queryKey: ["dash-precos-count"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
    },
  });

  const reAddSupplierMutation = useMutation({
    mutationFn: async (fornecedorId: string) => {
      if (!cotacaoAtiva?.id) return;
      await supabase.from("cotacao_fornecedores").insert({
        cotacao_id: cotacaoAtiva.id,
        fornecedor_id: fornecedorId,
      });
    },
    onSuccess: (_, fornecedorId) => {
      const f = allFornecedores.find(f => f.id === fornecedorId);
      toast.success(`${f?.nome || "Fornecedor"} re-adicionado à cotação`);
      queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
      queryClient.invalidateQueries({ queryKey: ["dash-respondidos"] });
      queryClient.invalidateQueries({ queryKey: ["dash-precos-count"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'precos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["resposta-count"] });
        queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores-count"] });
        queryClient.invalidateQueries({ queryKey: ["dash-respondidos"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotacao_produtos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ── Core queries ──
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
  });

  const { data: itemCount = 0 } = useQuery({
    queryKey: ["cotacao-item-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { count } = await supabase.from("cotacao_produtos").select("*", { count: "exact", head: true }).eq("cotacao_id", cotacaoAtiva!.id);
      return count || 0;
    },
  });

  const { data: fornecedorLojas = [] } = useQuery({
    queryKey: ["fornecedor-lojas"],
    queryFn: async () => { const { data } = await supabase.from("fornecedor_lojas").select("*"); return data || []; },
  });

  const { data: allFornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("*").order("nome"); return (data || []) as Fornecedor[]; },
  });

  const filteredFornecedores = useMemo(() => {
    // Show all suppliers — no store-based filtering so none are hidden
    return allFornecedores;
  }, [allFornecedores]);

  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => { const { data } = await supabase.from("cotacao_fornecedores").select("fornecedor_id, created_at").eq("cotacao_id", cotacaoAtiva!.id); return data || []; },
  });

  // Price count per supplier for State 4
  const { data: precosCountMap = new Map<string, number>() } = useQuery({
    queryKey: ["dash-precos-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return new Map<string, number>();
      const cpIds = cps.map(cp => cp.id);
      const { data } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      const counts = new Map<string, number>();
      (data || []).forEach(p => counts.set(p.fornecedor_id, (counts.get(p.fornecedor_id) || 0) + 1));
      return counts;
    },
  });

  // Sync selected suppliers from DB
  useEffect(() => {
    if (!filteredFornecedores.length || !cotacaoAtiva?.id) return;
    if (cotacaoFornecedores.length > 0) {
      const sel: Record<string, boolean> = {};
      filteredFornecedores.forEach((f) => { sel[f.id] = false; });
      cotacaoFornecedores.forEach((cf: any) => { sel[cf.fornecedor_id] = true; });
      setSelectedSuppliers(sel);
    }
  }, [filteredFornecedores, cotacaoFornecedores, cotacaoAtiva?.id]);

  const selectedFornecedores = useMemo(
    () => filteredFornecedores.filter(f => selectedSuppliers[f.id]),
    [filteredFornecedores, selectedSuppliers]
  );
  const selectedSupplierCount = selectedFornecedores.length;

  // Respondidos — set of fornecedor_ids who responded
  const { data: respondidosSet = new Set<string>() } = useQuery({
    queryKey: ["dash-respondidos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return new Set<string>();
      const cpIds = cps.map(cp => cp.id);
      const { data } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      return new Set((data || []).map(p => p.fornecedor_id));
    },
  });
  const respostaCount = respondidosSet.size;

  const { data: itensFaltantes = 0 } = useQuery({
    queryKey: ["itens-faltantes-count", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("itens_faltantes").select("*", { count: "exact", head: true }).eq("importado", false);
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      const { count } = await query;
      return count || 0;
    },
  });

  const { data: pedidosPendentes = 0 } = useQuery({
    queryKey: ["pedidos-pendentes"],
    queryFn: async () => {
      const { count } = await supabase.from("pedidos").select("*", { count: "exact", head: true }).eq("status", "enviado");
      return count || 0;
    },
  });

  // Last finalized quote (for state 1)
  const { data: lastCotacao } = useQuery({
    queryKey: ["last-cotacao", lojaAtiva?.id],
    queryFn: async () => {
      let q = supabase.from("cotacoes").select("nome, finalizada_at").neq("status", "ativa").order("finalizada_at", { ascending: false }).limit(1);
      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);
      const { data } = await q.maybeSingle();
      return data;
    },
  });

  // Economy estimate for state 5
  const { data: economyEstimate } = useQuery({
    queryKey: ["economy-estimate", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id && respostaCount > 1,
    queryFn: async () => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id, quantidade").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return null;
      const cpIds = cps.map(cp => cp.id);
      const { data: precos } = await supabase.from("precos").select("cotacao_produto_id, preco").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      if (!precos?.length) return null;
      
      let totalMin = 0, totalMax = 0;
      for (const cp of cps) {
        const cpPrecos = precos.filter(p => p.cotacao_produto_id === cp.id).map(p => Number(p.preco)).filter(v => v > 0);
        if (cpPrecos.length < 2) continue;
        const qty = cp.quantidade || 1;
        totalMin += Math.min(...cpPrecos) * qty;
        totalMax += Math.max(...cpPrecos) * qty;
      }
      return totalMax > totalMin ? totalMax - totalMin : null;
    },
  });

  // Pedidos for conclusion screen
  const { data: pedidosEnviados = [] } = useQuery({
    queryKey: ["pedidos-enviados-cotacao", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id && respostaCount >= selectedSupplierCount && selectedSupplierCount > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("fornecedor_id, total, status, fornecedores(nome)")
        .eq("cotacao_id", cotacaoAtiva!.id);
      return (data || []) as any[];
    },
  });

  // Check if all pedidos are sent → show conclusion
  const allPedidosSent = useMemo(() => {
    if (!pedidosEnviados.length || !cotacaoAtiva?.id) return false;
    return pedidosEnviados.every((p: any) => p.status === "enviado" || p.status === "confirmado" || p.status === "recebido");
  }, [pedidosEnviados, cotacaoAtiva?.id]);

  const conclusionDismissKey = `conclusao-vista-${cotacaoAtiva?.id}`;
  useEffect(() => {
    if (allPedidosSent && cotacaoAtiva?.id) {
      try {
        const dismissed = localStorage.getItem(conclusionDismissKey);
        if (!dismissed) setShowConclusao(true);
      } catch {}
    }
  }, [allPedidosSent, cotacaoAtiva?.id, conclusionDismissKey]);

  const dismissConclusao = () => {
    setShowConclusao(false);
    try { localStorage.setItem(conclusionDismissKey, "true"); } catch {}
  };

  const pedidoResumos = useMemo(() => 
    pedidosEnviados.map((p: any) => ({
      fornecedorNome: p.fornecedores?.nome || "Fornecedor",
      total: Number(p.total) || 0,
    })),
    [pedidosEnviados]
  );

  // Nova cotação handler
  const handleNovaCotacao = async () => {
    if (!cotacaoAtiva?.id || !novaCotacaoOpt) return;
    setNovaCotacaoLoading(true);
    try {
      // Finalize current
      await supabase.from("cotacoes").update({ status: "finalizada", finalizada_at: new Date().toISOString() }).eq("id", cotacaoAtiva.id);
      
      // Create new
      const nome = `Cotação ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
      const { data: newCot } = await supabase.from("cotacoes").insert({ nome, loja_id: lojaAtiva?.id || null, created_by: (await supabase.auth.getUser()).data.user?.id }).select().single();
      
      if (newCot && novaCotacaoOpt !== "zerar") {
        const { data: oldCps } = await supabase.from("cotacao_produtos").select("*").eq("cotacao_id", cotacaoAtiva.id);
        if (oldCps?.length) {
          const newCps = oldCps.map(cp => ({ cotacao_id: newCot.id, produto_id: cp.produto_id, quantidade: cp.quantidade }));
          const { data: insertedCps } = await supabase.from("cotacao_produtos").insert(newCps).select();
          
          if (novaCotacaoOpt === "manter_precos" && insertedCps?.length) {
            const oldIds = oldCps.map(cp => cp.id);
            const { data: oldPrecos } = await supabase.from("precos").select("*").in("cotacao_produto_id", oldIds);
            if (oldPrecos?.length) {
              const cpMap = new Map(oldCps.map((old, i) => [old.id, insertedCps[i]?.id]));
              const newPrecos = oldPrecos.filter(p => cpMap.has(p.cotacao_produto_id)).map(p => ({
                cotacao_produto_id: cpMap.get(p.cotacao_produto_id)!,
                fornecedor_id: p.fornecedor_id,
                preco: p.preco,
              }));
              if (newPrecos.length) await supabase.from("precos").insert(newPrecos);
            }
          }
        }
      }
      
      queryClient.invalidateQueries();
      setNovaCotacaoOpen(false);
      setNovaCotacaoOpt(null);
      setShowConclusao(false);
      toast.success("Nova cotação criada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cotação");
    }
    setNovaCotacaoLoading(false);
  };


  const saveSupplierSelection = async () => {
    if (!cotacaoAtiva?.id) return;
    const selected = filteredFornecedores.filter(f => selectedSuppliers[f.id]);
    await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotacaoAtiva.id);
    if (selected.length > 0) {
      await supabase.from("cotacao_fornecedores").insert(selected.map(f => ({ cotacao_id: cotacaoAtiva.id, fornecedor_id: f.id })));
    }
    queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
    setSupplierModalOpen(false);
    toast.success(`${selected.length} fornecedor(es) selecionado(s)`);
  };

  // Get link for a supplier
  const getLink = (f: Fornecedor) => {
    const base = `${window.location.origin}/fornecedor/${f.token}`;
    return lojaAtiva?.id ? `${base}?loja=${lojaAtiva.id}` : base;
  };

  const resendWhatsApp = (f: Fornecedor) => {
    const link = getLink(f);
    const msg = `Olá ${f.nome}! Segue o link para cotação de preços:\n\n${link}\n\nPreencha os preços e envie. Obrigado!`;
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const runFornSuggestion = async () => {
    if (!cotacaoAtiva?.id) return;
    setFornSuggestLoading(true); setFornSuggestOpen(true); setFornSuggestText(""); setFornSuggestHasHistory(false); setFornSuggestRecommendedIds([]);
    try {
      const resp = await supabase.functions.invoke("ai-automacao", { body: { type: "suggest-fornecedores", cotacao_id: cotacaoAtiva.id, loja_id: lojaAtiva?.id || null } });
      if (resp.error) throw new Error(resp.error.message);
      setFornSuggestText(resp.data?.text || "");
      setFornSuggestHasHistory(resp.data?.has_history ?? false);
      setFornSuggestRecommendedIds(resp.data?.recommended_supplier_ids || []);
    } catch (e: any) { toast.error(e.message || "Erro ao sugerir fornecedores"); }
    setFornSuggestLoading(false);
  };

  const applyFornSuggestions = () => {
    if (!fornSuggestRecommendedIds.length) return;
    const updated: Record<string, boolean> = {};
    filteredFornecedores.forEach((f) => { updated[f.id] = fornSuggestRecommendedIds.includes(f.id); });
    setSelectedSuppliers(updated);
    setFornSuggestOpen(false);
    toast.success(`${fornSuggestRecommendedIds.length} fornecedores recomendados selecionados!`);
  };

  type DashState = 1 | 2 | 3 | 4 | 5;
  const state: DashState = !cotacaoAtiva
    ? 1
    : itemCount === 0
    ? 2
    : (respostaCount === 0 && !sendCompleted)
    ? 3
    : (respostaCount === 0 && sendCompleted) || (respostaCount > 0 && respostaCount < selectedSupplierCount)
    ? 4
    : respostaCount >= selectedSupplierCount && selectedSupplierCount > 0
    ? 5
    : 3;

  // Detect send completed and cotação review from localStorage
  useEffect(() => {
    if (cotacaoAtiva?.id) {
      const reviewKey = `cotacao_revisada_${cotacaoAtiva.id}`;
      setCotacaoRevisada(localStorage.getItem(reviewKey) === "true");
      const sendKey = `send_completed_${cotacaoAtiva.id}`;
      setSendCompleted(localStorage.getItem(sendKey) === "true");
    } else {
      setCotacaoRevisada(false);
      setSendCompleted(false);
    }
  }, [cotacaoAtiva?.id]);

  const handleRevisarCotacao = () => {
    if (cotacaoAtiva?.id) {
      localStorage.setItem(`cotacao_revisada_${cotacaoAtiva.id}`, "true");
    }
    navigate("/cotacao?review=1");
  };

  // ── Action buttons shared across states 1 & 2 ──
  const ActionButtons = () => (
    <div className="space-y-2">
      {itensFaltantes > 0 && (
        <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate("/funcionarios")}>
          <ClipboardList className="h-5 w-5 text-primary" />
          <div className="text-left"><div className="text-sm font-semibold">Importar itens faltantes</div><div className="text-xs text-muted-foreground">{itensFaltantes} item(ns) pendente(s)</div></div>
        </Button>
      )}
      <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => {
        if (cotacaoAtiva?.id) setErpImportOpen(true);
        else { toast.info("Crie uma cotação primeiro na aba Cotação"); navigate("/cotacao"); }
      }}>
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <div className="text-left"><div className="text-sm font-semibold">Importar do ERP</div><div className="text-xs text-muted-foreground">Planilha Excel/CSV</div></div>
      </Button>
      <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate("/add-produtos")}>
        <Pencil className="h-5 w-5 text-primary" />
        <div className="text-left"><div className="text-sm font-semibold">Montar manualmente</div><div className="text-xs text-muted-foreground">Adicionar produtos um a um</div></div>
      </Button>
    </div>
  );

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <DashboardAlerts itensFaltantes={itensFaltantes} pedidosPendentes={pedidosPendentes} />

      <div className="animate-fade-in">
        {/* ── STATE 1: No active quote ── */}
        {state === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">Pronto para uma nova cotação?</h1>
              <p className="text-sm text-muted-foreground mt-1">Escolha como deseja começar</p>
            </div>
            <ActionButtons />
            {lastCotacao && (
              <Card className="mt-4">
                <CardContent className="p-3 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    Última cotação: <span className="font-semibold text-foreground">{lastCotacao.nome}</span>
                    {lastCotacao.finalizada_at && <> · {format(new Date(lastCotacao.finalizada_at), "dd/MM/yyyy")}</>}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── STATE 2: Active quote, no products ── */}
        {state === 2 && (
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">🟡 Cotação em andamento</Badge>
              <h1 className="text-xl font-bold text-foreground">Adicione os produtos à cotação</h1>
              <p className="text-sm text-muted-foreground mt-1">A lista está vazia. Importe ou adicione manualmente.</p>
            </div>
            <ActionButtons />
            <DashboardProgress currentStep={1} />
          </div>
        )}

        {/* ── STATE 3: Products added, awaiting send ── */}
        {state === 3 && (
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">🟡 Aguardando envio</Badge>
              <h1 className="text-xl font-bold text-foreground">Cotação pronta! Envie para os fornecedores</h1>
            </div>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground text-lg">{itemCount}</span> produtos · <span className="font-bold text-foreground text-lg">{selectedSupplierCount}</span> fornecedores
                </div>
              </CardContent>
            </Card>
            <Button
              variant={selectedSupplierCount > 0 ? "outline" : "default"}
              className={`w-full h-12 gap-2 text-base transition-all ${
                selectedSupplierCount > 0
                  ? "border-green-500 dark:border-green-600 text-green-700 dark:text-green-400"
                  : ""
              }`}
              onClick={() => setSupplierModalOpen(true)}
            >
              {selectedSupplierCount > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              {selectedSupplierCount > 0 ? `${selectedSupplierCount} fornecedor(es) selecionado(s) ✓` : "1. Selecionar fornecedores"}
            </Button>
            <Button
              className={`w-full h-12 text-base gap-2 transition-all ${
                selectedSupplierCount > 0
                  ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                  : ""
              }`}
              variant={selectedSupplierCount > 0 ? "default" : "outline"}
              disabled={selectedSupplierCount === 0}
              onClick={() => setSendQueueOpen(true)}
            >
              <Send className="h-5 w-5" /> 2. Enviar para todos
            </Button>
            <DashboardProgress currentStep={2} />
            <Card className="border-dashed border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={runFornSuggestion}>
              <CardContent className="p-3 flex items-center gap-3">
                <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                <div className="text-xs text-muted-foreground">
                  💡 Quer sugestões de fornecedores baseadas no histórico?
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-xs text-primary">Ver sugestões</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── STATE 4: Receiving responses ── */}
        {state === 4 && (() => {
          const pct = selectedSupplierCount > 0 ? Math.round((respostaCount / selectedSupplierCount) * 100) : 0;
          const statusMsg = pct === 0 ? "⏳ Aguardando respostas..." : pct <= 50 ? "🔵 Chegando respostas!" : pct < 100 ? "🟢 Quase lá! Falta pouco..." : "✅ Todas recebidas!";
          const cfMap = new Map(cotacaoFornecedores.map((cf: any) => [cf.fornecedor_id, cf.created_at]));
          const selectedIds = new Set(cotacaoFornecedores.map((cf: any) => cf.fornecedor_id));
          const removedSuppliers = allFornecedores.filter(f => !selectedIds.has(f.id));
          const pendingOver2h = selectedFornecedores.filter(f => {
            if (respondidosSet.has(f.id)) return false;
            const sentAt = cfMap.get(f.id);
            if (!sentAt) return false;
            return Date.now() - new Date(sentAt).getTime() > 2 * 60 * 60 * 1000;
          });

          return (
            <div className="space-y-2">
              {/* Header */}
              <div>
                <Badge variant="secondary" className="mb-1 text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">{statusMsg}</Badge>
                <h1 className="text-2xl font-bold text-foreground">{respostaCount} de {selectedSupplierCount} fornecedores responderam</h1>
              </div>

              {/* Progress bar — thin & elegant */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums ${pct >= 100 ? "text-green-500" : "text-primary"}`}>{pct}%</span>
              </div>

              {/* Supplier list — compact single-line cards */}
              <div className="space-y-1.5">
                {selectedFornecedores.map(f => {
                  const responded = respondidosSet.has(f.id);
                  const sentAt = cfMap.get(f.id);
                  const priceCount = precosCountMap.get(f.id) || 0;
                  const timeAgo = sentAt ? formatDistanceToNow(new Date(sentAt), { addSuffix: true, locale: ptBR }) : null;

                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-2.5 rounded-lg border py-2.5 px-3 transition-all ${
                        responded
                          ? "border-l-2 border-l-green-500 border-t-border border-r-border border-b-border"
                          : "border-border"
                      }`}
                    >
                      {responded
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-semibold text-foreground truncate">{f.nome}</span>
                      <span className="text-xs text-muted-foreground truncate ml-auto mr-1">
                        {responded
                          ? `Respondeu · ${priceCount} preço${priceCount !== 1 ? "s" : ""}`
                          : timeAgo ? `Enviado ${timeAgo}` : "Aguardando"}
                      </span>
                      <button
                        onClick={() => resendWhatsApp(f)}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Reenviar via WhatsApp"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRemoveSupplier(f)}
                        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remover da cotação"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Hint cards for suppliers pending > 2h */}
              {pendingOver2h.length > 0 && (
                <div className="space-y-1.5">
                  {pendingOver2h.map(f => {
                    const sentAt = cfMap.get(f.id);
                    const timeAgo = sentAt ? formatDistanceToNow(new Date(sentAt), { addSuffix: true, locale: ptBR }) : "";
                    return (
                      <button
                        key={`hint-${f.id}`}
                        onClick={() => {
                          const link = getLink(f);
                          const msg = `Olá ${f.nome}! Vi que ainda não preencheu a cotação de preços. Segue o link novamente:\n\n${link}\n\nPrecisa de ajuda? Estou à disposição!`;
                          const phone = f.telefone?.replace(/\D/g, "");
                          const url = phone
                            ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`
                            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                          window.open(url, "_blank");
                        }}
                        className="w-full flex items-start gap-2 rounded-lg border border-amber-300/40 dark:border-amber-700/40 bg-amber-50/40 dark:bg-amber-950/10 py-2 px-3 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                      >
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground flex-1">
                          <span className="font-semibold text-foreground">{f.nome}</span> sem resposta ({timeAgo}). Que tal entrar em contato?
                        </p>
                        <MessageCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Single action button — outline compact */}
              <Button variant="outline" className="gap-2 text-sm h-10" onClick={() => navigate("/cotacao?from=dashboard")}>
                <Eye className="h-4 w-4" /> Ver cotação parcial
              </Button>

              <DashboardProgress currentStep={3} />
            </div>
          );
        })()}

        {/* ── STATE 5: All responded — sub-states ── */}
        {state === 5 && (
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                🟢 Pronto para decidir!
              </Badge>
              <h1 className="text-xl font-bold text-foreground">Todos os fornecedores responderam</h1>
            </div>
            {economyEstimate && economyEstimate > 0 && (
              <Card className="border-green-500/30 bg-green-950/10 dark:bg-green-950/20 shadow-[0_0_15px_rgba(16,185,129,0.08)]">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">💰 Economia estimada</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400">{formatBRL(economyEstimate)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">comparado ao fornecedor mais caro</p>
                </CardContent>
              </Card>
            )}

            {/* Sub-state A: Revisar cotação (primary) */}
            <Button
              className={`w-full h-14 text-base gap-2 ${
                !cotacaoRevisada
                  ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                  : "border-green-500 text-green-700 dark:text-green-400"
              }`}
              variant={cotacaoRevisada ? "outline" : "default"}
              onClick={handleRevisarCotacao}
            >
              {cotacaoRevisada ? (
                <><CheckCircle2 className="h-5 w-5" /> Cotação revisada ✓</>
              ) : (
                <><Eye className="h-5 w-5" /> 1. Revisar cotação completa</>
              )}
            </Button>

            {/* Sub-state B: Ver pedidos (becomes primary after review) */}
            <Button
              className={`w-full gap-2 ${
                cotacaoRevisada
                  ? "h-14 text-base bg-gradient-to-r from-primary to-primary/80 shadow-lg animate-fade-in"
                  : "h-12"
              }`}
              variant={cotacaoRevisada ? "default" : "outline"}
              onClick={() => navigate("/analise")}
            >
              <Trophy className={cotacaoRevisada ? "h-5 w-5" : "h-4 w-4"} />
              {cotacaoRevisada ? "2. Ver pedidos prontos para envio 🏆" : "2. Ver pedidos prontos para envio"}
            </Button>

            <DashboardProgress currentStep={4} />
          </div>
        )}
      </div>

      {state !== 4 && <DashboardHistorico />}

      {/* Conclusion Screen */}
      {showConclusao && (
        <ConclusaoScreen
          economyEstimate={economyEstimate || null}
          pedidos={pedidoResumos}
          onNewCotacao={() => setNovaCotacaoOpen(true)}
          onDismiss={dismissConclusao}
        />
      )}

      {/* Modals */}
      {cotacaoAtiva?.id && (
        <ImportErpModal open={erpImportOpen} onOpenChange={setErpImportOpen} cotacaoId={cotacaoAtiva.id} />
      )}
      <SendQueueModal
        open={sendQueueOpen}
        onOpenChange={setSendQueueOpen}
        fornecedores={selectedFornecedores}
        onConclude={() => {
          if (cotacaoAtiva?.id) {
            localStorage.setItem(`send_completed_${cotacaoAtiva.id}`, "true");
          }
          setSendCompleted(true);
          queryClient.invalidateQueries({ queryKey: ["dash-respondidos"] });
          queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores"] });
          toast.success("Cotação enviada! Aguardando respostas dos fornecedores.");
        }}
      />
      <ModalFornecedores
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        fornecedores={filteredFornecedores}
        selectedSuppliers={selectedSuppliers}
        onToggle={(id) => setSelectedSuppliers(prev => ({ ...prev, [id]: !prev[id] }))}
        onSelectAll={(val) => {
          const next: Record<string, boolean> = {};
          filteredFornecedores.forEach(f => { next[f.id] = val; });
          setSelectedSuppliers(next);
        }}
        onSave={saveSupplierSelection}
      />
      <ModalFornecedorSugestao open={fornSuggestOpen} onOpenChange={setFornSuggestOpen} text={fornSuggestText} loading={fornSuggestLoading} hasHistory={fornSuggestHasHistory} recommendedIds={fornSuggestRecommendedIds} onApply={applyFornSuggestions} />
      <ModalNovaCotacao open={novaCotacaoOpen} onOpenChange={setNovaCotacaoOpen} novaCotacaoOpt={novaCotacaoOpt} setNovaCotacaoOpt={setNovaCotacaoOpt} onConfirm={handleNovaCotacao} loading={novaCotacaoLoading} />

      <AlertDialog open={!!removeSupplier} onOpenChange={(open) => { if (!open) setRemoveSupplier(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fornecedor da cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{removeSupplier?.nome}</span> será removido desta cotação e seus preços apagados. O cadastro do fornecedor não será afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeSupplier && removeSupplierMutation.mutate(removeSupplier.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DashboardPage;
