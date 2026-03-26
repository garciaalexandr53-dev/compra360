import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, FileSpreadsheet, Pencil, Send, Users, Eye, Trophy, RefreshCw, Smartphone, CheckCircle2, Clock, Target, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
  const [novaCotacaoOpen, setNovaCotacaoOpen] = useState(false);
  const [novaCotacaoOpt, setNovaCotacaoOpt] = useState<"manter" | "manter_precos" | "zerar" | null>(null);
  const [novaCotacaoLoading, setNovaCotacaoLoading] = useState(false);

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
    if (!lojaAtiva?.id) return allFornecedores;
    const linkedToStore = new Set(fornecedorLojas.filter((fl: any) => fl.loja_id === lojaAtiva.id).map((fl: any) => fl.fornecedor_id));
    const allLinked = new Set(fornecedorLojas.map((fl: any) => fl.fornecedor_id));
    return allFornecedores.filter((f) => linkedToStore.has(f.id) || !allLinked.has(f.id));
  }, [allFornecedores, fornecedorLojas, lojaAtiva?.id]);

  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => { const { data } = await supabase.from("cotacao_fornecedores").select("fornecedor_id").eq("cotacao_id", cotacaoAtiva!.id); return data || []; },
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
    : respostaCount === 0
    ? 3
    : respostaCount > 0 && respostaCount < selectedSupplierCount
    ? 4
    : respostaCount >= selectedSupplierCount && selectedSupplierCount > 0
    ? 5
    : 3;

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
            <Button className="w-full h-12 text-base gap-2" onClick={() => setSendQueueOpen(true)}>
              <Send className="h-5 w-5" /> Enviar para todos
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => setSupplierModalOpen(true)}>
              <Users className="h-4 w-4" /> Gerenciar fornecedores
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
        {state === 4 && (
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">🔵 Recebendo respostas</Badge>
              <h1 className="text-xl font-bold text-foreground">{respostaCount} de {selectedSupplierCount} fornecedores responderam</h1>
            </div>
            <Progress value={(respostaCount / selectedSupplierCount) * 100} className="h-2" />
            <div className="space-y-2">
              {selectedFornecedores.map(f => {
                const responded = respondidosSet.has(f.id);
                return (
                  <div key={f.id} className={`flex items-center gap-3 p-3 rounded-lg border ${responded ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20" : "border-border"}`}>
                    {responded ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{f.nome}</span>
                    {!responded && (
                      <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => resendWhatsApp(f)}>
                        <RefreshCw className="h-3 w-3" /> Reenviar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/cotacao")}>
              <Eye className="h-4 w-4" /> Ver cotação parcial
            </Button>
            <DashboardProgress currentStep={3} />
          </div>
        )}

        {/* ── STATE 5: All responded ── */}
        {state === 5 && (
          <div className="space-y-5">
            <div>
              <Badge variant="secondary" className="mb-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">🟢 Pronto para decidir!</Badge>
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
            <Button className="w-full h-14 text-base gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg" onClick={() => navigate("/analise")}>
              <Trophy className="h-5 w-5" /> 🏆 Ver pedidos prontos para envio
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/cotacao")}>
              <Eye className="h-4 w-4" /> Ver cotação completa
            </Button>
            <DashboardProgress currentStep={4} />
          </div>
        )}
      </div>

      <DashboardHistorico />

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
    </div>
  );
};

export default DashboardPage;
