import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Users, Store, Package, FileText, Send, ClipboardCheck, Loader2,
  Search, ShieldCheck, RefreshCw, ArrowLeft, AlertTriangle, TimerReset, Activity,
  MessageCircle, Mail, X, Download, ChevronRight, FileSpreadsheet, CreditCard, History,
} from "lucide-react";
import { buildClientesCsv, buildClientesXlsx, clientesFilename, clientesFilenameXlsx, downloadCsv, downloadXlsx } from "@/lib/adminExports";
import { formatDate } from "@/lib/format";
import {
  Cliente, getDiasSemUso, getDiasTrialRestantes, getSaudeCliente, PLAN_COLORS, SituacaoCliente,
  MotivoContato, situacaoParaMotivo,
} from "@/lib/adminHelpers";


import ContatoModal from "@/components/admin/ContatoModal";
import MetricSheets, { SheetType } from "@/components/admin/MetricSheets";
import AlertasTab from "@/components/admin/AlertasTab";
import EmailsTab from "@/components/admin/EmailsTab";
import PagamentosTab from "@/components/admin/PagamentosTab";
import ClienteDetalhesSheet from "@/components/admin/ClienteDetalhesSheet";
import ContatosTab from "@/components/admin/ContatosTab";
import CatalogoTab from "@/components/admin/CatalogoTab";
import HistoricoCatalogoTab from "@/components/admin/HistoricoCatalogoTab";
import { MrrBreakdownCard, GrowthChart, ChurnRiskCard } from "@/components/admin/MetricasExtras";


type GlobalMetrics = {
  total_usuarios: number;
  usuarios_7d: number;
  usuarios_30d: number;
  total_lojas: number;
  total_produtos: number;
  total_produtos_ativos: number;
  total_fornecedores: number;
  total_cotacoes: number;
  cotacoes_ativas: number;
  cotacoes_finalizadas: number;
  total_pedidos: number;
  pedidos_enviados: number;
  total_conferencias: number;
  plan_distribution: Record<string, number>;
  mrr_estimado: number;
  trials_ativos: number;
  trials_expirando_7d: number;
  em_risco_churn: number;
  taxa_ativacao: number;
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("metricas");
  const [scrollToSection, setScrollToSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroPlano, setFiltroPlano] = useState<"todos" | "free" | "business" | "pro">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "dormindo" | "risco" | "trial">("todos");
  const [filtroAtivacao, setFiltroAtivacao] = useState<"todos" | "com_cotacao" | "sem_cotacao">("todos");
  const [ordenacao, setOrdenacao] = useState<"recentes" | "antigos" | "maior_uso" | "risco_churn">("recentes");
  const [confirmActivate, setConfirmActivate] = useState<Cliente | null>(null);
  const [planEdit, setPlanEdit] = useState<{ cliente: Cliente; novoPlano: string } | null>(null);
  const [sheetType, setSheetType] = useState<SheetType>(null);
  const [contato, setContato] = useState<{
    cliente: Cliente | null;
    canal: "whatsapp" | "email";
    situacao?: SituacaoCliente;
    motivo?: MotivoContato;
  }>({ cliente: null, canal: "whatsapp" });
  const [clienteDetalhe, setClienteDetalhe] = useState<Cliente | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");



  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (activeTab === "alertas" && scrollToSection) {
      requestAnimationFrame(() => {
        const el = document.getElementById(scrollToSection);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setScrollToSection(null);
      });
    }
  }, [activeTab, scrollToSection]);

  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_global_metrics");
      if (error) throw error;
      return data as unknown as GlobalMetrics;
    },
    enabled: !!isAdmin,
  });

  const { data: clientes, isLoading: loadingClientes, refetch: refetchClientes } = useQuery({
    queryKey: ["admin-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_clientes");
      if (error) throw error;
      const raw = (data || []) as Cliente[];
      // Deduplicar por user_id mantendo o registro mais completo
      const map = new Map<string, Cliente>();
      raw.forEach((c) => {
        const existing = map.get(c.user_id);
        if (!existing || (c.total_cotacoes || 0) > (existing.total_cotacoes || 0)) {
          map.set(c.user_id, c);
        }
      });
      return Array.from(map.values());
    },
    enabled: !!isAdmin,
  });

  const { data: ultimosContatos } = useQuery({
    queryKey: ["admin-ultimos-contatos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_ultimos_contatos");
      if (error) throw error;
      const map = new Map<string, { canal: string; created_at: string }>();
      ((data || []) as Array<{ user_id: string; canal: string; created_at: string }>).forEach((r) => {
        map.set(r.user_id, { canal: r.canal, created_at: r.created_at });
      });
      return map;
    },
    enabled: !!isAdmin,
  });




  const activateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("admin_activate_all_produtos", { _user_id: userId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast({ title: "Produtos ativados", description: `${count} produtos foram reativados.` });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      setConfirmActivate(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const setPlanMutation = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const { error } = await supabase.rpc("admin_set_user_plan", { _user_id: userId, _plan_name: plan });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plano atualizado", description: "O cliente já está no novo plano." });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      setPlanEdit(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId, confirm_email: email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Conta excluída", description: "O cliente e todos os seus dados foram removidos." });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics"] });
      setConfirmDelete(null);
      setDeleteConfirmEmail("");
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });


  const filtrosAtivos = useMemo(() => {
    return (
      filtroPlano !== "todos" ||
      filtroStatus !== "todos" ||
      filtroAtivacao !== "todos" ||
      ordenacao !== "recentes" ||
      search.trim().length > 0
    );
  }, [filtroPlano, filtroStatus, filtroAtivacao, ordenacao, search]);

  const filteredClientes = useMemo(() => {
    let result = (clientes || []).filter((c) => {
      // Busca textual
      const q = search.toLowerCase().trim();
      if (q) {
        const matchText =
          c.email?.toLowerCase().includes(q) ||
          c.loja_principal?.toLowerCase().includes(q) ||
          c.cnpj?.toLowerCase().includes(q);
        if (!matchText) return false;
      }

      // Filtro por plano
      if (filtroPlano !== "todos" && c.plan_name !== filtroPlano) return false;

      // Filtro por status
      if (filtroStatus !== "todos") {
        const diasSemUso = getDiasSemUso(c);
        const saude = getSaudeCliente(c);
        switch (filtroStatus) {
          case "ativo":
            if (saude.status !== "ativo") return false;
            break;
          case "dormindo":
            if (diasSemUso === null || diasSemUso <= 14) return false;
            break;
          case "risco":
            if (diasSemUso === null || diasSemUso <= 21) return false;
            break;
          case "trial":
            if (c.plan_status !== "trialing") return false;
            break;
        }
      }

      // Filtro por ativação
      if (filtroAtivacao !== "todos") {
        const temCotacao = (c.total_cotacoes || 0) > 0;
        if (filtroAtivacao === "com_cotacao" && !temCotacao) return false;
        if (filtroAtivacao === "sem_cotacao" && temCotacao) return false;
      }

      return true;
    });

    // Ordenação
    result = [...result].sort((a, b) => {
      switch (ordenacao) {
        case "recentes":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "antigos":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "maior_uso":
          return (b.total_cotacoes || 0) - (a.total_cotacoes || 0);
        case "risco_churn": {
          const diasA = getDiasSemUso(a) ?? -1;
          const diasB = getDiasSemUso(b) ?? -1;
          return diasB - diasA;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [clientes, search, filtroPlano, filtroStatus, filtroAtivacao, ordenacao]);

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              Acesso negado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
              Voltar ao dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const limparFiltros = () => {
    setSearch("");
    setFiltroPlano("todos");
    setFiltroStatus("todos");
    setFiltroAtivacao("todos");
    setOrdenacao("recentes");
  };

  const abrirContato = (cliente: Cliente, situacao?: SituacaoCliente, canal: "whatsapp" | "email" = "whatsapp", motivo?: MotivoContato) => {
    setContato({ cliente, canal, situacao, motivo: motivo ?? situacaoParaMotivo(situacao) });
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="truncate">Painel Administrativo</span>
              </h1>
              <p className="text-xs text-muted-foreground truncate">Compra360 — Visão completa</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchMetrics(); refetchClientes(); }}
          >
            <RefreshCw className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 sm:grid-cols-8 h-auto w-full sm:w-auto sm:inline-flex">

            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="pagamentos" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              E-mails
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>


          {/* MÉTRICAS */}
          <TabsContent value="metricas" className="space-y-6">
            {loadingMetrics ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : metrics ? (
              <>
                <Section titulo="Receita e assinaturas">
                  <div className="col-span-2 md:col-span-2">
                    <MrrBreakdownCard clientes={clientes || []} onOpenMrr={() => setSheetType("mrr")} />
                  </div>
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Trials ativos"
                    value={metrics.trials_ativos.toString()} onClick={() => setSheetType("trials")} />
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Plano Free"
                    value={(metrics.plan_distribution?.free || 0).toString()} onClick={() => setSheetType("free")} />
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Pro / Business"
                    value={((metrics.plan_distribution?.pro || 0) + (metrics.plan_distribution?.business || 0)).toString()}
                    onClick={() => setSheetType("pagantes")} />
                </Section>

                <Section titulo="Crescimento">
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Total usuários"
                    value={metrics.total_usuarios.toString()} onClick={() => setSheetType("todos")} />
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Novos (7d)"
                    value={`+${metrics.usuarios_7d}`} onClick={() => setSheetType("novos7")} />
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Novos (30d)"
                    value={`+${metrics.usuarios_30d}`} onClick={() => setSheetType("novos30")} />
                  <MetricCard icon={<Store className="h-4 w-4" />} label="Lojas"
                    value={metrics.total_lojas.toString()} onClick={() => setSheetType("lojas")} />
                  <MetricCard
                    icon={<TimerReset className="h-4 w-4" />}
                    label="Trials expirando (7d)"
                    value={metrics.trials_expirando_7d.toString()}
                    danger={metrics.trials_expirando_7d > 0}
                    onClick={() => {
                      setActiveTab("alertas");
                      setScrollToSection("alertas-trials");
                    }}
                  />
                  <ChurnRiskCard
                    clientes={clientes || []}
                    onClick={() => {
                      setActiveTab("alertas");
                      setScrollToSection("alertas-churn");
                    }}
                  />
                  <MetricCard
                    icon={<Activity className="h-4 w-4" />}
                    label="Taxa de ativação"
                    value={`${metrics.taxa_ativacao}%`}
                    sub="usuários com cotação"
                  />
                </Section>

                <GrowthChart clientes={clientes || []} />


                <Section titulo="Uso da plataforma">
                  <MetricCard icon={<Package className="h-4 w-4" />} label="Produtos"
                    value={metrics.total_produtos.toString()} sub={`${metrics.total_produtos_ativos} ativos`}
                    onClick={() => setSheetType("produtos")} />
                  <MetricCard icon={<Users className="h-4 w-4" />} label="Fornecedores"
                    value={metrics.total_fornecedores.toString()} onClick={() => setSheetType("fornecedores")} />
                  <MetricCard icon={<FileText className="h-4 w-4" />} label="Cotações"
                    value={metrics.total_cotacoes.toString()}
                    sub={`${metrics.cotacoes_ativas} ativas · ${metrics.cotacoes_finalizadas} finalizadas`}
                    onClick={() => setSheetType("cotacoes")} />
                  <MetricCard icon={<Send className="h-4 w-4" />} label="Pedidos"
                    value={metrics.total_pedidos.toString()} sub={`${metrics.pedidos_enviados} enviados`}
                    onClick={() => setSheetType("pedidos")} />
                </Section>

                <div>
                  <MetricCard icon={<ClipboardCheck className="h-4 w-4" />}
                    label="Conferências realizadas" value={metrics.total_conferencias.toString()} />
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alertas">
            {loadingClientes ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AlertasTab
                clientes={clientes || []}
                onContatar={(c, situacao, canal) => abrirContato(c, situacao, canal)}
              />
            )}
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="space-y-4">
            <div className="space-y-3">
              {/* Busca + contador + exports */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email, loja ou CNPJ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-normal">
                    {filteredClientes.length} de {clientes?.length || 0}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={() => downloadCsv(clientesFilename(), buildClientesCsv(filteredClientes))}
                    disabled={filteredClientes.length === 0}
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1"
                    onClick={() => downloadXlsx(clientesFilenameXlsx(), buildClientesXlsx(filteredClientes))}
                    disabled={filteredClientes.length === 0}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Excel
                  </Button>
                </div>
              </div>

              {/* Filtros 2x2 com destaque quando ativos */}
              <div className="grid grid-cols-2 gap-2 sm:max-w-2xl">
                {(() => {
                  const activeCls = (active: boolean) =>
                    `h-9 text-xs ${active ? "border-teal-500 text-teal-700 dark:text-teal-400 font-medium" : ""}`;
                  return (
                    <>
                      <Select value={filtroPlano} onValueChange={(v) => setFiltroPlano(v as typeof filtroPlano)}>
                        <SelectTrigger className={activeCls(filtroPlano !== "todos")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Plano: Todos</SelectItem>
                          <SelectItem value="free">Plano: Free</SelectItem>
                          <SelectItem value="business">Plano: Business</SelectItem>
                          <SelectItem value="pro">Plano: Pro</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
                        <SelectTrigger className={activeCls(filtroStatus !== "todos")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Status: Todos</SelectItem>
                          <SelectItem value="ativo">Status: Ativo</SelectItem>
                          <SelectItem value="dormindo">Status: Dormindo</SelectItem>
                          <SelectItem value="risco">Status: Risco</SelectItem>
                          <SelectItem value="trial">Status: Trial</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={filtroAtivacao} onValueChange={(v) => setFiltroAtivacao(v as typeof filtroAtivacao)}>
                        <SelectTrigger className={activeCls(filtroAtivacao !== "todos")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Ativação: Todos</SelectItem>
                          <SelectItem value="com_cotacao">Ativação: Com cotação</SelectItem>
                          <SelectItem value="sem_cotacao">Ativação: Sem cotação</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
                        <SelectTrigger className={activeCls(ordenacao !== "recentes")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recentes">Ordem: Recentes</SelectItem>
                          <SelectItem value="antigos">Ordem: Antigos</SelectItem>
                          <SelectItem value="maior_uso">Ordem: Maior uso</SelectItem>
                          <SelectItem value="risco_churn">Ordem: Risco de churn</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  );
                })()}
              </div>

              {filtrosAtivos && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limparFiltros}>
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>

            {loadingClientes ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {filteredClientes.map((c) => {
                      const saude = getSaudeCliente(c);
                      const diasTrial = getDiasTrialRestantes(c.trial_end);
                      const isTrial = c.plan_status === "trialing";
                      const uc = ultimosContatos?.get(c.user_id);
                      const dotColor =
                        saude.status === "ativo" ? "bg-emerald-500"
                          : saude.status === "dormindo" ? "bg-destructive"
                          : saude.status === "risco" ? "bg-amber-500"
                          : "bg-muted-foreground/50";
                      return (
                        <li key={c.user_id}>
                          <button
                            type="button"
                            onClick={() => setClienteDetalhe(c)}
                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-muted/40 transition-colors text-left min-h-[52px]"
                            title={saude.label}
                          >
                            <span
                              className={`shrink-0 h-2.5 w-2.5 rounded-full ${dotColor}`}
                              aria-label={saude.label}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {c.loja_principal || c.email}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.ultima_cotacao_at
                                  ? `Última cotação: ${formatDate(c.ultima_cotacao_at)}`
                                  : "Sem cotação"}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] px-1.5 py-0 hidden sm:inline-flex ${PLAN_COLORS[c.plan_name] || ""}`}
                            >
                              {c.plan_name}
                              {isTrial && diasTrial !== null && <span className="ml-1">·{diasTrial}d</span>}
                            </Badge>
                            <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 min-w-[28px] justify-end">
                              {uc ? (
                                <>
                                  {uc.canal === "whatsapp"
                                    ? <MessageCircle className="h-3 w-3 text-emerald-600" />
                                    : <Mail className="h-3 w-3 text-blue-600" />}
                                  <span className="hidden sm:inline">{formatDate(uc.created_at)}</span>
                                </>
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                            <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                    {filteredClientes.length === 0 && (
                      <li className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum cliente encontrado.
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PAGAMENTOS */}
          <TabsContent value="pagamentos">
            <PagamentosTab />
          </TabsContent>

          {/* CONTATOS */}
          <TabsContent value="contatos">
            <ContatosTab
              clientes={clientes}
              onSelectCliente={(userId) => {
                const c = (clientes || []).find((x) => x.user_id === userId);
                if (c) setClienteDetalhe(c);
              }}
            />
          </TabsContent>

          {/* E-MAILS */}
          <TabsContent value="emails">
            <EmailsTab />
          </TabsContent>

          {/* CATÁLOGO MESTRE */}
          <TabsContent value="catalogo">
            <CatalogoTab />
          </TabsContent>
        </Tabs>

      </main>

      {/* Sheets de detalhes por métrica */}
      <MetricSheets
        type={sheetType}
        clientes={clientes || []}
        metrics={metrics}
        onClose={() => setSheetType(null)}
        onContatar={(c) => abrirContato(c)}
      />

      {/* Modal de contato */}
      <ContatoModal
        cliente={contato.cliente}
        initialCanal={contato.canal}
        forcarSituacao={contato.situacao}
        motivo={contato.motivo}
        onClose={() => setContato({ cliente: null, canal: "whatsapp" })}
      />


      {/* Detalhes do cliente */}
      <ClienteDetalhesSheet
        cliente={clienteDetalhe}
        onClose={() => setClienteDetalhe(null)}
        onContatar={(c, canal) => {
          setClienteDetalhe(null);
          abrirContato(c, undefined, canal, "manual");
        }}

        onAlterarPlano={(c) => {
          setClienteDetalhe(null);
          setPlanEdit({ cliente: c, novoPlano: c.plan_name });
        }}
        onExcluir={(c) => {
          setClienteDetalhe(null);
          setDeleteConfirmEmail("");
          setConfirmDelete(c);
        }}
      />

      {/* Excluir cliente */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) { setConfirmDelete(null); setDeleteConfirmEmail(""); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta conta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o login de <strong>{confirmDelete?.email}</strong> e todos os dados
              vinculados: lojas, produtos, categorias, fornecedores, cotações, pedidos, conferências
              e assinatura. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Para confirmar, digite o e-mail do cliente:
            </p>
            <Input
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={confirmDelete?.email || ""}
              autoComplete="off"
              inputMode="email"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                deleteClienteMutation.isPending ||
                deleteConfirmEmail.trim().toLowerCase() !== (confirmDelete?.email || "").toLowerCase()
              }
              onClick={(e) => {
                e.preventDefault();
                if (!confirmDelete) return;
                deleteClienteMutation.mutate({
                  userId: confirmDelete.user_id,
                  email: deleteConfirmEmail.trim(),
                });
              }}
            >
              {deleteClienteMutation.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Ativar produtos */}
      <AlertDialog open={!!confirmActivate} onOpenChange={(o) => !o && setConfirmActivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar todos os produtos?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso reativará {confirmActivate?.total_produtos_inativos} produtos inativos de{" "}
              <strong>{confirmActivate?.loja_principal || confirmActivate?.email}</strong>. Eles voltarão
              a aparecer na Reposição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmActivate && activateMutation.mutate(confirmActivate.user_id)}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? "Ativando..." : "Ativar todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alterar plano */}
      <AlertDialog open={!!planEdit} onOpenChange={(o) => !o && setPlanEdit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar plano do cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Defina manualmente o plano de{" "}
              <strong>{planEdit?.cliente.loja_principal || planEdit?.cliente.email}</strong>. A
              assinatura ficará ativa por 30 dias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select
              value={planEdit?.novoPlano}
              onValueChange={(v) => planEdit && setPlanEdit({ ...planEdit, novoPlano: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planEdit && setPlanMutation.mutate({ userId: planEdit.cliente.user_id, plan: planEdit.novoPlano })}
              disabled={setPlanMutation.isPending}
            >
              {setPlanMutation.isPending ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{titulo}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, highlight, danger, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={[
        onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all" : "",
        highlight ? "border-primary/40 bg-primary/5" : "",
        danger ? "border-destructive/40 bg-destructive/5" : "",
      ].filter(Boolean).join(" ")}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""} ${danger ? "text-destructive" : ""}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}
