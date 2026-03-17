import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { formatBRL } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { BarChart3, Package, Users, ShoppingCart, UserCheck, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DashboardPage = () => {
  const { lojaAtiva } = useLojaAtiva();
  const navigate = useNavigate();

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

  const { data: itensFaltantes = 0 } = useQuery({
    queryKey: ["itens-faltantes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("itens_faltantes").select("*", { count: "exact", head: true }).eq("importado", false);
      return count || 0;
    },
  });

  const { data: selectedFornecedorCount = 0 } = useQuery({
    queryKey: ["cotacao-fornecedores-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { count } = await supabase.from("cotacao_fornecedores").select("*", { count: "exact", head: true }).eq("cotacao_id", cotacaoAtiva!.id);
      return count || 0;
    },
  });

  const steps = [
    {
      label: "Produtos",
      desc: `${itemCount} itens na cotação`,
      done: itemCount > 0,
      icon: Package,
      action: () => navigate("/produtos"),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Fornecedores",
      desc: `${selectedFornecedorCount} selecionados`,
      done: selectedFornecedorCount > 0,
      icon: Users,
      action: () => navigate("/fornecedores"),
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Cotação",
      desc: `${respostaCount} respostas recebidas`,
      done: respostaCount > 0,
      icon: BarChart3,
      action: () => navigate("/cotacao"),
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      label: "Pedidos",
      desc: "Analisar e enviar",
      done: false,
      icon: ShoppingCart,
      action: () => navigate("/resumo"),
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  return (
    <div className="p-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Olá! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lojaAtiva ? `Loja ativa: ${lojaAtiva.nome}` : "Selecione uma loja para começar"}
        </p>
      </div>

      {/* Active quote status */}
      <div className={`rounded-xl p-4 mb-6 border ${cotacaoAtiva ? "bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark))] text-white border-transparent" : "bg-muted"}`}>
        {cotacaoAtiva ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">Cotação Ativa</p>
              <p className="text-lg font-bold mt-1">{cotacaoAtiva.nome}</p>
              <p className="text-xs opacity-70 mt-0.5">{itemCount} produtos · {respostaCount} respostas</p>
            </div>
            <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => navigate("/cotacao")}>
              Abrir <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-muted-foreground font-medium">Nenhuma cotação ativa</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/cotacao")}>
              Criar cotação
            </Button>
          </div>
        )}
      </div>

      {/* Wizard steps */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Fluxo de Trabalho</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={step.action}
              className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${step.done ? "border-green-200 bg-green-50/50" : "bg-card"}`}
            >
              {step.done && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
              <div className={`h-8 w-8 rounded-lg ${step.bgColor} flex items-center justify-center mb-2`}>
                <step.icon className={`h-4 w-4 ${step.color}`} />
              </div>
              <p className="text-xs font-bold text-foreground">{step.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick alerts */}
      {itensFaltantes > 0 && (
        <button
          onClick={() => navigate("/funcionarios")}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 hover:shadow-md transition-all mb-4"
        >
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-amber-800">{itensFaltantes} itens faltantes pendentes</p>
            <p className="text-xs text-amber-600">Enviados pelos funcionários · Clique para importar</p>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-400" />
        </button>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{itemCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Produtos</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{fornecedorCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fornecedores</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{respostaCount}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Respostas</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
