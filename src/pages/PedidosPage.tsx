import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

const PedidosPage = () => {
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

  // Build orders per supplier (best price wins)
  const orders = useMemo(() => {
    const result: Record<string, { produto: string; embalagem: string; quantidade: number; preco: number; total: number }[]> = {};
    fornecedores.forEach((f) => { result[f.id] = []; });

    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;

      // Find min price
      let minP: any = cpPrecos[0];
      cpPrecos.forEach((p: any) => { if (p.preco < minP.preco) minP = p; });

      const qt = cp.quantidade || 1;
      const total = minP.preco * qt;
      result[minP.fornecedor_id]?.push({
        produto: cp.produtos?.nome || "?",
        embalagem: cp.produtos?.embalagem || "un",
        quantidade: qt,
        preco: minP.preco,
        total,
      });
    });
    return result;
  }, [cotacaoProdutos, precos, fornecedores]);

  const sendWhatsApp = (f: Fornecedor) => {
    const items = orders[f.id] || [];
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);
    const date = new Date().toLocaleDateString("pt-BR");
    let msg = `📋 *PEDIDO DE COMPRA - COTAFÁCIL*\n-----\n📦 *Fornecedor:* ${f.nome}\n📅 *Data:* ${date}\n📝 *Itens:* ${items.length}\n-----\n`;
    items.forEach((it, i) => {
      msg += `\n*${i + 1}. ${it.produto}*\n    Qtd: ${it.quantidade} ${it.embalagem}\n    Preço: R$ ${it.preco.toFixed(2).replace(".", ",")}  →  *Total: R$ ${it.total.toFixed(2).replace(".", ",")}*\n`;
    });
    msg += `\n-----\n💰 *TOTAL GERAL: ${formatBRL(total)}*\n-----\n_Enviado via CotaFácil_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="p-5 pb-20">
      <h1 className="text-xl font-bold mb-1">Pedidos por Fornecedor</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Clique em <strong className="text-green-700">Enviar Pedido</strong> para enviar via WhatsApp.
      </p>

      {fornecedores.map((f) => {
        const items = orders[f.id] || [];
        if (!items.length) return null;
        const total = items.reduce((s, it) => s + it.total, 0);
        const minOk = !f.pedido_minimo || f.pedido_minimo <= 0 || total >= f.pedido_minimo;

        return (
          <div key={f.id} className="bg-card border rounded-xl shadow-sm mb-3 overflow-hidden">
            {f.pedido_minimo && f.pedido_minimo > 0 && !minOk && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-sm text-red-700">
                ⚠️ Pedido mínimo não atingido! Faltam <strong>{formatBRL(f.pedido_minimo - total)}</strong> para atingir R$ {f.pedido_minimo.toFixed(2).replace(".", ",")}
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground">{f.nome}</div>
                <div className="text-xs text-muted-foreground">{items.length} itens{f.pedido_minimo && f.pedido_minimo > 0 ? ` · mín: ${formatBRL(f.pedido_minimo)}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => sendWhatsApp(f)}>
                  📱 Enviar Pedido
                </Button>
                <span className={`text-lg font-extrabold font-mono ${minOk ? "text-green-700" : "text-red-600"}`}>
                  {formatBRL(total)}
                </span>
              </div>
            </div>
            <div className="border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">QT</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">EMBAL</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground">PRODUTO</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">PREÇO</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                      <td className="px-3 py-2 text-center">{it.quantidade}</td>
                      <td className="px-3 py-2 text-center">{it.embalagem}</td>
                      <td className="px-3 py-2 font-medium">{it.produto}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold text-green-700">R${it.preco.toFixed(2).replace(".", ",")}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold text-amber-700">{formatBRL(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {fornecedores.every((f) => !(orders[f.id] || []).length) && (
        <div className="text-center py-10 text-muted-foreground">Nenhum item com preço ainda.</div>
      )}
    </div>
  );
};

export default PedidosPage;
