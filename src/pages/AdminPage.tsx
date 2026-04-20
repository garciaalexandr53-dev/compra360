import { useEffect, useState } from "react";
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
  Users, Store, Package, FileText, Send, ClipboardCheck,
  TrendingUp, Loader2, Search, ShieldCheck, RefreshCw, ArrowLeft,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";

type Cliente = {
  user_id: string;
  email: string;
  created_at: string;
  loja_principal: string | null;
  cnpj: string | null;
  total_lojas: number;
  total_produtos: number;
  total_produtos_inativos: number;
  total_fornecedores: number;
  total_cotacoes: number;
  total_pedidos: number;
  plan_name: string;
  plan_status: string;
  trial_end: string | null;
};

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
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmActivate, setConfirmActivate] = useState<Cliente | null>(null);
  const [planEdit, setPlanEdit] = useState<{ cliente: Cliente; novoPlano: string } | null>(null);

  // Verifica se é admin
  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
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
      return (data || []) as Cliente[];
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
            <p className="text-sm text-muted-foreground">
              Esta área é restrita a administradores.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
              Voltar ao dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredClientes = (clientes || []).filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.email?.toLowerCase().includes(q) ||
      c.loja_principal?.toLowerCase().includes(q) ||
      c.cnpj?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Painel Administrativo
              </h1>
              <p className="text-xs text-muted-foreground">Compra360 — Visão completa</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchMetrics();
              refetchClientes();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="metricas" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-flex">
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          {/* MÉTRICAS */}
          <TabsContent value="metricas" className="space-y-6">
            {loadingMetrics ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : metrics ? (
              <>
                {/* Receita / Assinaturas */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Receita e assinaturas
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                      icon={<TrendingUp className="h-4 w-4" />}
                      label="MRR estimado"
                      value={formatBRL(metrics.mrr_estimado)}
                      highlight
                    />
                    <MetricCard
                      icon={<Users className="h-4 w-4" />}
                      label="Trials ativos"
                      value={metrics.trials_ativos.toString()}
                    />
                    <MetricCard
                      icon={<Users className="h-4 w-4" />}
                      label="Plano Free"
                      value={(metrics.plan_distribution?.free || 0).toString()}
                    />
                    <MetricCard
                      icon={<Users className="h-4 w-4" />}
                      label="Plano Pro/Business"
                      value={(
                        (metrics.plan_distribution?.pro || 0) +
                        (metrics.plan_distribution?.business || 0)
                      ).toString()}
                    />
                  </div>
                </div>

                {/* Usuários */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Crescimento
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard icon={<Users className="h-4 w-4" />} label="Total usuários" value={metrics.total_usuarios.toString()} />
                    <MetricCard icon={<Users className="h-4 w-4" />} label="Novos (7d)" value={`+${metrics.usuarios_7d}`} />
                    <MetricCard icon={<Users className="h-4 w-4" />} label="Novos (30d)" value={`+${metrics.usuarios_30d}`} />
                    <MetricCard icon={<Store className="h-4 w-4" />} label="Lojas" value={metrics.total_lojas.toString()} />
                  </div>
                </div>

                {/* Uso */}
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Uso da plataforma
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard
                      icon={<Package className="h-4 w-4" />}
                      label="Produtos"
                      value={metrics.total_produtos.toString()}
                      sub={`${metrics.total_produtos_ativos} ativos`}
                    />
                    <MetricCard icon={<Users className="h-4 w-4" />} label="Fornecedores" value={metrics.total_fornecedores.toString()} />
                    <MetricCard
                      icon={<FileText className="h-4 w-4" />}
                      label="Cotações"
                      value={metrics.total_cotacoes.toString()}
                      sub={`${metrics.cotacoes_ativas} ativas · ${metrics.cotacoes_finalizadas} finalizadas`}
                    />
                    <MetricCard
                      icon={<Send className="h-4 w-4" />}
                      label="Pedidos"
                      value={metrics.total_pedidos.toString()}
                      sub={`${metrics.pedidos_enviados} enviados`}
                    />
                  </div>
                  <div className="mt-3">
                    <MetricCard
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      label="Conferências realizadas"
                      value={metrics.total_conferencias.toString()}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="space-y-4">
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
              <p className="text-sm text-muted-foreground">
                {filteredClientes.length} de {clientes?.length || 0} clientes
              </p>
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
                      {filteredClientes.map((c) => (
                        <TableRow key={c.user_id}>
                          <TableCell>
                            <div className="font-medium">{c.loja_principal || "—"}</div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                            {c.cnpj && <div className="text-xs text-muted-foreground">{c.cnpj}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={PLAN_COLORS[c.plan_name] || ""}>
                              {c.plan_name}
                              {c.plan_status === "trialing" && " (trial)"}
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
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {c.total_produtos_inativos > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => setConfirmActivate(c)}
                                >
                                  Ativar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setPlanEdit({ cliente: c, novoPlano: c.plan_name })}
                              >
                                Plano
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
        </Tabs>
      </main>

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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              onClick={() =>
                planEdit &&
                setPlanMutation.mutate({ userId: planEdit.cliente.user_id, plan: planEdit.novoPlano })
              }
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

function MetricCard({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
