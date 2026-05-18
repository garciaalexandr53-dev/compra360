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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Users, Store, Package, FileText, Send, ClipboardCheck, TrendingUp, Loader2,
  Search, ShieldCheck, RefreshCw, ArrowLeft, AlertTriangle, TimerReset, Activity,
  MessageCircle, Mail, X, Download,
} from "lucide-react";
import { buildClientesCsv, clientesFilename, downloadCsv } from "@/lib/adminExports";
import { formatBRL, formatDate } from "@/lib/format";
import {
  Cliente, getDiasSemUso, getDiasTrialRestantes, getSaudeCliente, PLAN_COLORS, SituacaoCliente,
  MotivoContato, situacaoParaMotivo,
} from "@/lib/adminHelpers";

import { PLAN_PRICE_NUMERIC } from "@/lib/planPrices";
import ContatoModal from "@/components/admin/ContatoModal";
import MetricSheets, { SheetType } from "@/components/admin/MetricSheets";
import AlertasTab from "@/components/admin/AlertasTab";
import EmailsTab from "@/components/admin/EmailsTab";
import ClienteDetalhesSheet from "@/components/admin/ClienteDetalhesSheet";

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

  // MRR recalculado a partir dos clientes únicos (evita inflação por duplicatas)
  const mrrCalculado = (clientes || [])
    .filter((c) => c.plan_status === "active" && (c.plan_name === "pro" || c.plan_name === "business"))
    .reduce((s, c) => s + (PLAN_PRICE_NUMERIC[c.plan_name] || 0), 0);

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

  const filtrosAtivos = useMemo(() => {
    return (
      filtroPlano !== "todos" ||
      filtroStatus !== "todos" ||
      filtroAtivacao !== "todos" ||
      ordenacao !== "recentes" ||
      search.trim().length > 0
    );
  }, [filtroPlano, filtroStatus, filtroAtivacao, ordenacao, search]);

  const limparFiltros = () => {
    setSearch("");
    setFiltroPlano("todos");
    setFiltroStatus("todos");
    setFiltroAtivacao("todos");
    setOrdenacao("recentes");
  };

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

  const abrirContato = (cliente: Cliente, situacao?: SituacaoCliente, canal: "whatsapp" | "email" = "whatsapp") => {
    setContato({ cliente, canal, situacao });
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
        <Tabs defaultValue="metricas" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-flex">
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              E-mails
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
                  <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="MRR estimado"
                    value={formatBRL(mrrCalculado)} highlight onClick={() => setSheetType("mrr")} />
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
                    onClick={() => setSheetType("trials")}
                  />
                  <MetricCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label="Em risco de churn"
                    value={metrics.em_risco_churn.toString()}
                    danger={metrics.em_risco_churn > 0}
                  />
                  <MetricCard
                    icon={<Activity className="h-4 w-4" />}
                    label="Taxa de ativação"
                    value={`${metrics.taxa_ativacao}%`}
                    sub="usuários com cotação"
                  />
                </Section>

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
              {/* Busca + contador */}
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
                    {filteredClientes.length} de {clientes?.length || 0} clientes
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => downloadCsv(clientesFilename(), buildClientesCsv(filteredClientes))}
                    disabled={filteredClientes.length === 0}
                  >
                    <Download className="h-3 w-3" />
                    Exportar CSV
                  </Button>
                  {filtrosAtivos && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limparFiltros}>
                      <X className="h-3 w-3 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={filtroPlano} onValueChange={(v) => setFiltroPlano(v as typeof filtroPlano)}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue placeholder="Plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="ativo">Ativo (7d)</SelectItem>
                    <SelectItem value="dormindo">Dormindo (&gt;14d)</SelectItem>
                    <SelectItem value="risco">Risco (&gt;21d)</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroAtivacao} onValueChange={(v) => setFiltroAtivacao(v as typeof filtroAtivacao)}>
                  <SelectTrigger className="h-8 text-xs w-[150px]">
                    <SelectValue placeholder="Ativação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="com_cotacao">Com cotação</SelectItem>
                    <SelectItem value="sem_cotacao">Sem cotação</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
                  <SelectTrigger className="h-8 text-xs w-[170px]">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recentes">Mais recentes</SelectItem>
                    <SelectItem value="antigos">Mais antigos</SelectItem>
                    <SelectItem value="maior_uso">Maior uso</SelectItem>
                    <SelectItem value="risco_churn">Risco de churn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingClientes ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Lojas</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="text-right">Forn.</TableHead>
                        <TableHead className="text-right">Cotações</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.map((c) => {
                        const saude = getSaudeCliente(c);
                        const diasTrial = getDiasTrialRestantes(c.trial_end);
                        const trialUrgente = c.plan_status === "trialing" && diasTrial !== null && diasTrial <= 3;
                        return (
                          <TableRow
                            key={c.user_id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => setClienteDetalhe(c)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate max-w-[180px]">{c.loja_principal || "—"}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${saude.className}`}>
                                      {saude.emoji} {saude.label}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email}</div>
                                  {c.cnpj && <div className="text-xs text-muted-foreground">{c.cnpj}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={trialUrgente
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : (PLAN_COLORS[c.plan_name] || "")}
                              >
                                {c.plan_name}
                                {c.plan_status === "trialing" && diasTrial !== null && (
                                  <span className="ml-1">(trial · {diasTrial}d)</span>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.total_lojas}</TableCell>
                            <TableCell className="text-right">
                              {c.total_produtos}
                              {c.total_produtos_inativos > 0 && (
                                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">
                                  {c.total_produtos_inativos} inat.
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{c.total_fornecedores}</TableCell>
                            <TableCell className="text-right">{c.total_cotacoes}</TableCell>
                            <TableCell className="text-right">{c.total_pedidos}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-7 w-7"
                                  title="WhatsApp"
                                  onClick={() => abrirContato(c, undefined, "whatsapp")}
                                >
                                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                                {c.email && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    title="Email"
                                    onClick={() => abrirContato(c, undefined, "email")}
                                  >
                                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                                  </Button>
                                )}
                                {c.total_produtos_inativos > 0 && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => setConfirmActivate(c)}>
                                    Ativar
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => setPlanEdit({ cliente: c, novoPlano: c.plan_name })}>
                                  Plano
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredClientes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            Nenhum cliente encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* E-MAILS */}
          <TabsContent value="emails">
            <EmailsTab />
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
        onClose={() => setContato({ cliente: null, canal: "whatsapp" })}
      />

      {/* Detalhes do cliente */}
      <ClienteDetalhesSheet
        cliente={clienteDetalhe}
        onClose={() => setClienteDetalhe(null)}
        onContatar={(c, canal) => {
          setClienteDetalhe(null);
          abrirContato(c, undefined, canal);
        }}
        onAlterarPlano={(c) => {
          setClienteDetalhe(null);
          setPlanEdit({ cliente: c, novoPlano: c.plan_name });
        }}
      />

      {/* Ativar produtos */}
      <AlertDialog open={!!confirmActivate} onOpenChange={(o) => !o && setConfirmActivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar todos os produtos?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso reativará {confirmActivate?.total_produtos_inativos} produtos inativos de{" "}
              <strong>{confirmActivate?.loja_principal || confirmActivate?.email}</strong>. Eles voltarão
              a aparecer no App Funcionários.
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
