import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Package, TrendingUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReposicaoItem {
  produtoNome: string;
  mediaIntervaloDias: number;
  diasDesdeUltimaCompra: number;
  status: "urgente" | "proximo" | "normal";
  ultimaCompra: string;
}

const DashboardReposicao = () => {
  const { lojaAtiva } = useLojaAtiva();
  const [open, setOpen] = useState(false);

  // Fetch finalized cotacoes with their products and dates
  const { data: reposicaoItems, isLoading } = useQuery({
    queryKey: ["reposicao-alertas", lojaAtiva?.id],
    queryFn: async () => {
      // Get finalized cotacoes (last 10)
      let q = supabase
        .from("cotacoes")
        .select("id, created_at, finalizada_at")
        .in("status", ["finalizada"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);

      const { data: cotacoes } = await q;
      if (!cotacoes?.length || cotacoes.length < 2) return [];

      const cotacaoIds = cotacoes.map((c) => c.id);

      // Get products in those cotacoes
      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("produto_id, cotacao_id, produtos(nome)")
        .in("cotacao_id", cotacaoIds);

      if (!cps?.length) return [];

      // Build per-product purchase dates
      const produtoCompras: Record<string, { nome: string; datas: string[] }> = {};

      for (const cp of cps) {
        const cot = cotacoes.find((c) => c.id === cp.cotacao_id);
        if (!cot) continue;
        const date = cot.finalizada_at || cot.created_at;
        const nome = (cp.produtos as any)?.nome || "Produto";

        if (!produtoCompras[cp.produto_id]) {
          produtoCompras[cp.produto_id] = { nome, datas: [] };
        }
        produtoCompras[cp.produto_id].datas.push(date);
      }

      const now = new Date();
      const items: ReposicaoItem[] = [];

      for (const [, info] of Object.entries(produtoCompras)) {
        // Need at least 2 purchases to calculate interval
        if (info.datas.length < 2) continue;

        const sorted = info.datas
          .map((d) => new Date(d))
          .sort((a, b) => a.getTime() - b.getTime());

        // Calculate average interval between purchases
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          intervals.push(differenceInDays(sorted[i], sorted[i - 1]));
        }
        const avgInterval = Math.round(
          intervals.reduce((a, b) => a + b, 0) / intervals.length
        );

        if (avgInterval < 1) continue;

        const lastPurchase = sorted[sorted.length - 1];
        const daysSince = differenceInDays(now, lastPurchase);

        // Determine status
        let status: ReposicaoItem["status"] = "normal";
        if (daysSince >= avgInterval * 1.2) {
          status = "urgente";
        } else if (daysSince >= avgInterval * 0.8) {
          status = "proximo";
        }

        // Only include items that are "proximo" or "urgente"
        if (status !== "normal") {
          items.push({
            produtoNome: info.nome,
            mediaIntervaloDias: avgInterval,
            diasDesdeUltimaCompra: daysSince,
            status,
            ultimaCompra: lastPurchase.toISOString(),
          });
        }
      }

      // Sort: urgente first, then proximo
      items.sort((a, b) => {
        if (a.status === "urgente" && b.status !== "urgente") return -1;
        if (b.status === "urgente" && a.status !== "urgente") return 1;
        return b.diasDesdeUltimaCompra - a.diasDesdeUltimaCompra;
      });

      return items.slice(0, 10); // Max 10
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const urgentes = reposicaoItems?.filter((i) => i.status === "urgente") || [];
  const proximos = reposicaoItems?.filter((i) => i.status === "proximo") || [];

  if (isLoading || !reposicaoItems?.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg text-left hover:shadow-sm transition-shadow">
          <Package className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <span className="text-sm text-orange-800 dark:text-orange-300 flex-1">
            {urgentes.length > 0 && (
              <span className="font-semibold">{urgentes.length} produto(s) precisam reposição urgente</span>
            )}
            {urgentes.length > 0 && proximos.length > 0 && " · "}
            {proximos.length > 0 && (
              <span>{proximos.length} próximo(s) da data de reposição</span>
            )}
          </span>
          <Badge variant="outline" className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 text-xs shrink-0">
            {open ? "Ocultar" : "Ver"}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 animate-fade-in">
        {reposicaoItems.map((item, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
              item.status === "urgente"
                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            }`}
          >
            {item.status === "urgente" ? (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${
                item.status === "urgente"
                  ? "text-red-800 dark:text-red-300"
                  : "text-amber-800 dark:text-amber-300"
              }`}>
                {item.produtoNome}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compra a cada ~{item.mediaIntervaloDias}d · Última{" "}
                {formatDistanceToNow(new Date(item.ultimaCompra), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
            <Badge
              variant={item.status === "urgente" ? "destructive" : "secondary"}
              className="text-xs shrink-0"
            >
              {item.diasDesdeUltimaCompra}d atrás
            </Badge>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DashboardReposicao;
