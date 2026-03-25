import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, FileSpreadsheet, Pencil, Send, Users, Eye, Trophy, RefreshCw, Smartphone, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

import DashboardAlerts from "@/components/dashboard/DashboardAlerts";
import DashboardProgress from "@/components/dashboard/DashboardProgress";
import DashboardHistorico from "@/components/dashboard/DashboardHistorico";
import SendQueueModal from "@/components/dashboard/SendQueueModal";
import ImportErpModal from "@/components/ImportErpModal";
import ModalFornecedores from "@/components/cotacao/ModalFornecedores";

type Fornecedor = Tables<"fornecedores">;

const DashboardPage = () => {
  const { lojaAtiva } = useLojaAtiva();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [erpImportOpen, setErpImportOpen] = useState(false);
  const [sendQueueOpen, setSendQueueOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});

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
        const qty = cp.quantity || 1;
        totalMin += Math.min(...cpPrecos) * qty;
        totalMax += Math.max(...cpPrecos) * qty;
      }
      return totalMax > totalMin ? totalMax - totalMin : null;
    },
  });

  // Save supplier selection
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

  // ── Determine state ──
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
      <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate("/produtos")}>
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
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Economia estimada entre o maior e menor preço</p>
                  <p className="text-2xl font-bold text-primary">{formatBRL(economyEstimate)}</p>
                </CardContent>
              </Card>
            )}
            <Button className="w-full h-12 text-base gap-2" onClick={() => navigate("/analise")}>
              <Trophy className="h-5 w-5" /> Ver análise e gerar pedidos
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/cotacao")}>
              <Eye className="h-4 w-4" /> Ver cotação completa
            </Button>
            <DashboardProgress currentStep={4} />
          </div>
        )}
      </div>

      <DashboardHistorico />

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
    </div>
  );
};

export default DashboardPage;
