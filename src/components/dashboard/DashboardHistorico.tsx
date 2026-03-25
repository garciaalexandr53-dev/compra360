import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, History, Trophy, MessageSquare, Star } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DashboardHistorico = () => {
  const { lojaAtiva } = useLojaAtiva();
  const [open, setOpen] = useState(false);

  const { data: totalCotacoes = 0 } = useQuery({
    queryKey: ["hist-total-cotacoes", lojaAtiva?.id],
    queryFn: async () => {
      let q = supabase.from("cotacoes").select("*", { count: "exact", head: true }).neq("status", "ativa");
      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);
      const { count } = await q;
      return count || 0;
    },
  });

  const { data: fornecedorMaisCompetitivo } = useQuery({
    queryKey: ["hist-fornecedor-competitivo", lojaAtiva?.id],
    queryFn: async () => {
      let q = supabase.from("cotacoes").select("id").neq("status", "ativa").order("created_at", { ascending: false }).limit(3);
      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);
      const { data: cots } = await q;
      if (!cots?.length) return null;
      const cotIds = cots.map(c => c.id);
      const { data: cps } = await supabase.from("cotacao_produtos").select("id, cotacao_id").in("cotacao_id", cotIds);
      if (!cps?.length) return null;
      const cpIds = cps.map(cp => cp.id);
      const { data: precos } = await supabase.from("precos").select("cotacao_produto_id, fornecedor_id, preco").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      if (!precos?.length) return null;
      const byCP: Record<string, { fornecedor_id: string; preco: number }[]> = {};
      for (const p of precos) {
        if (!byCP[p.cotacao_produto_id]) byCP[p.cotacao_produto_id] = [];
        byCP[p.cotacao_produto_id].push({ fornecedor_id: p.fornecedor_id, preco: Number(p.preco) });
      }
      const wins: Record<string, number> = {};
      for (const cpId of Object.keys(byCP)) {
        const sorted = byCP[cpId].sort((a, b) => a.preco - b.preco);
        if (sorted.length > 0) wins[sorted[0].fornecedor_id] = (wins[sorted[0].fornecedor_id] || 0) + 1;
      }
      const winnerId = Object.entries(wins).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!winnerId) return null;
      const { data: forn } = await supabase.from("fornecedores").select("nome").eq("id", winnerId).single();
      return forn?.nome || null;
    },
  });

  const { data: mediaRespostas } = useQuery({
    queryKey: ["hist-media-respostas", lojaAtiva?.id],
    queryFn: async () => {
      let q = supabase.from("cotacoes").select("id").neq("status", "ativa").order("created_at", { ascending: false }).limit(5);
      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);
      const { data: cots } = await q;
      if (!cots?.length) return null;
      let totalRespondentes = 0;
      for (const cot of cots) {
        const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cot.id);
        if (!cps?.length) continue;
        const cpIds = cps.map(cp => cp.id);
        const { data: precos } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", cpIds).not("preco", "is", null);
        if (precos) totalRespondentes += new Set(precos.map(p => p.fornecedor_id)).size;
      }
      return (totalRespondentes / cots.length).toFixed(1);
    },
  });

  const { data: produtosMaisCotados } = useQuery({
    queryKey: ["hist-produtos-top", lojaAtiva?.id],
    queryFn: async () => {
      let q = supabase.from("cotacoes").select("id").neq("status", "ativa");
      if (lojaAtiva?.id) q = q.eq("loja_id", lojaAtiva.id);
      const { data: cots } = await q;
      if (!cots?.length) return null;
      const cotIds = cots.map(c => c.id);
      const { data: cps } = await supabase.from("cotacao_produtos").select("produto_id").in("cotacao_id", cotIds);
      if (!cps?.length) return null;
      const freq: Record<string, number> = {};
      for (const cp of cps) freq[cp.produto_id] = (freq[cp.produto_id] || 0) + 1;
      const top3Ids = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
      const { data: prods } = await supabase.from("produtos").select("id, nome").in("id", top3Ids);
      if (!prods) return null;
      return top3Ids.map(id => prods.find(p => p.id === id)?.nome).filter(Boolean) as string[];
    },
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <CollapsibleTrigger className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Ocultar histórico" : "Ver histórico"}
      </CollapsibleTrigger>
      <CollapsibleContent className="animate-fade-in">
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1"><History className="h-4 w-4 text-primary shrink-0" /><span className="text-xs font-medium text-muted-foreground">Cotações realizadas</span></div>
            <p className="text-lg font-bold text-foreground">{totalCotacoes > 0 ? totalCotacoes : <span className="text-sm font-normal text-muted-foreground">Sem dados</span>}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1"><Trophy className="h-4 w-4 text-primary shrink-0" /><span className="text-xs font-medium text-muted-foreground">Mais competitivo</span></div>
            <p className="text-sm font-bold text-foreground truncate">{fornecedorMaisCompetitivo || <span className="font-normal text-muted-foreground">Sem dados</span>}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4 text-primary shrink-0" /><span className="text-xs font-medium text-muted-foreground">Média respostas</span></div>
            <p className="text-lg font-bold text-foreground">{mediaRespostas || <span className="text-sm font-normal text-muted-foreground">Sem dados</span>}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1"><Star className="h-4 w-4 text-primary shrink-0" /><span className="text-xs font-medium text-muted-foreground">Mais cotados</span></div>
            {produtosMaisCotados?.length ? (
              <ul className="space-y-0.5">{produtosMaisCotados.map((nome, i) => <li key={i} className="text-xs text-foreground truncate">• {nome}</li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
          </CardContent></Card>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DashboardHistorico;
