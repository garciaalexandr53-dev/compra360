import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

const ResumoPage = () => {
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cotacoes").select("*").eq("status", "ativa").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const { data: cotacaoProdutos = [] } = useQuery({
    queryKey: ["cotacao-produtos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_produtos")
        .select("*, produtos(*, categorias(nome))")
        .eq("cotacao_id", cotacaoAtiva!.id);
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

  const stats = useMemo(() => {
    const totalItems = cotacaoProdutos.length;
    
    // Fornecedores that have at least one price
    const fornecedoresComPreco = new Set(precos.filter((p: any) => p.preco !== null && p.preco > 0).map((p: any) => p.fornecedor_id));
    const responderam = fornecedoresComPreco.size;

    // Items with at least one price
    const itensCotados = new Set(precos.filter((p: any) => p.preco !== null && p.preco > 0).map((p: any) => p.cotacao_produto_id)).size;
    const cobertura = totalItems > 0 ? Math.round((itensCotados / totalItems) * 100) : 0;

    // Calculate per-supplier stats
    const supplierStats = fornecedores.map((f) => {
      let quotedCount = 0;
      let winsCount = 0;
      let totalPedido = 0;

      cotacaoProdutos.forEach((cp: any) => {
        const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
        const myPrice = cpPrecos.find((p: any) => p.fornecedor_id === f.id);
        if (myPrice) quotedCount++;

        if (cpPrecos.length > 0) {
          const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
          if (myPrice && myPrice.preco === minPrice) {
            winsCount++;
            totalPedido += myPrice.preco * (cp.quantidade || 1);
          }
        }
      });

      const pct = quotedCount > 0 ? Math.round((winsCount / quotedCount) * 100) : 0;
      return { fornecedor: f, quotedCount, winsCount, pct, totalPedido, recv: fornecedoresComPreco.has(f.id) };
    });

    // Grand total (sum of best prices * quantities)
    let grandTotal = 0;
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (cpPrecos.length > 0) {
        const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
        grandTotal += minPrice * (cp.quantidade || 1);
      }
    });

    return { totalItems, responderam, itensCotados, cobertura, grandTotal, supplierStats };
  }, [cotacaoProdutos, precos, fornecedores]);

  if (!cotacaoAtiva) {
    return <div className="p-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;
  }

  return (
    <div className="p-5">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        {/* Total Card - accent */}
        <div className="relative bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark))] text-white rounded-xl p-4 shadow-lg overflow-hidden">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-65">Total da Compra</div>
          <div className="text-xl font-extrabold tracking-tight mt-1 font-mono">{formatBRL(stats.grandTotal)}</div>
          <div className="text-xs opacity-60 mt-1">{stats.totalItems} produtos</div>
        </div>

        <KpiCard label="Fornecedores" value={String(fornecedores.length)} sub={`${stats.responderam} responderam`} />
        <KpiCard label="Cobertura" value={`${stats.cobertura}%`} sub={`${stats.itensCotados} de ${stats.totalItems} cotados`} />
        <KpiCard label="Itens Cotados" value={String(stats.itensCotados)} sub={`de ${stats.totalItems} total`} />
      </div>

      {/* Supplier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.supplierStats.map((s) => (
          <div key={s.fornecedor.id} className={`bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${s.recv ? "border-l-[3px] border-l-green-500" : ""}`}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">{s.fornecedor.nome}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.recv ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {s.recv ? "Recebido" : "Aguardando"}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full my-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${s.pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Preços cotados</span>
              <span className="font-bold text-foreground">{s.quotedCount}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Menor preço em</span>
              <span className="font-bold text-green-700">{s.winsCount} ({s.pct}%)</span>
            </div>
            <div className="border-t mt-3 pt-3 flex justify-between items-baseline">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total pedido</span>
              <span className="text-base font-extrabold text-green-700 font-mono">{formatBRL(s.totalPedido)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="relative bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-extrabold text-foreground tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

export default ResumoPage;
