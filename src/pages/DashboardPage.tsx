import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { formatBRL } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { Package, Users, BarChart3, ShoppingCart, AlertCircle, CheckCircle2, Clock, History, Trophy, MessageSquare, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const DashboardPage = () => {
  const { lojaAtiva } = useLojaAtiva();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime — atualiza contadores quando precos ou cotacao_produtos mudam
  useEffect(() => {
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'precos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["resposta-count"] });
        queryClient.invalidateQueries({ queryKey: ["cotacao-fornecedores-count"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotacao_produtos' }, () => {
        queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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

  const { data: fornecedorCount = 0 } = useQuery({
    queryKey: ["fornecedor-count"],
    queryFn: async () => {
      const { count } = await supabase.from("fornecedores").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: respostaCount = 0 } = useQuery({
    queryKey: ["resposta-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const cpIds = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cpIds.data?.length) return 0;
      const ids = cpIds.data.map((cp) => cp.id);
      const { data } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", ids).not("preco", "is", null);
      if (!data) return 0;
      return new Set(data.map((p) => p.fornecedor_id)).size;
    },
  });

  const { data: selectedSupplierCount = 0 } = useQuery({
    queryKey: ["cotacao-fornecedores-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { count } = await supabase.from("cotacao_fornecedores").select("*", { count: "exact", head: true }).eq("cotacao_id", cotacaoAtiva!.id);
      return count || 0;
    },
  });

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

  const steps = [
    {
      num: 1,
      label: "Produtos",
      desc: `${itemCount} itens na cotação`,
      done: itemCount > 0,
      action: () => navigate("/produtos"),
      icon: Package,
    },
    {
      num: 2,
      label: "Fornecedores",
      desc: `${selectedSupplierCount} selecionados de ${fornecedorCount}`,
      done: selectedSupplierCount > 0,
      action: () => navigate("/fornecedores"),
      icon: Users,
    },
    {
      num: 3,
      label: "Cotação",
      desc: `${respostaCount} respostas recebidas`,
      done: respostaCount > 0,
      action: () => navigate("/cotacao"),
      icon: BarChart3,
    },
    {
      num: 4,
      label: "Pedidos",
      desc: respostaCount > 0 ? "Pronto para analisar" : "Aguardando respostas",
      done: pedidosPendentes > 0,
      action: () => navigate("/analise"),
      icon: ShoppingCart,
    },
  ];

  return (
    <div className="p-5 max-w-2xl mx-auto">
      {/* Status */}
      <p className="text-sm text-muted-foreground mb-4">
        {cotacaoAtiva
          ? `Cotação ativa: ${cotacaoAtiva.nome}`
          : "Nenhuma cotação ativa — crie uma na aba Cotação"}
      </p>

      {/* Steps */}
      <div className="space-y-2 mb-5">
        {steps.map((step) => (
          <button
            key={step.num}
            onClick={step.action}
            className="w-full flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors text-left group"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step.done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
            }`}>
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.num}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{step.label}</div>
              <div className="text-xs text-muted-foreground">{step.desc}</div>
            </div>
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {(itensFaltantes > 0 || pedidosPendentes > 0) && (
        <div className="space-y-2">
          {itensFaltantes > 0 && (
            <button onClick={() => navigate("/funcionarios")} className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left hover:shadow-sm transition-shadow">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800">{itensFaltantes} item(ns) faltantes aguardando importação</span>
            </button>
          )}
          {pedidosPendentes > 0 && (
            <button onClick={() => navigate("/analise")} className="w-full flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left hover:shadow-sm transition-shadow">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-800">{pedidosPendentes} pedido(s) aguardando confirmação</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
