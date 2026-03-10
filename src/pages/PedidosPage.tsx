import { useState, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

const PedidosPage = () => {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cotacoes").select("*").eq("status", "ativa").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: allFornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  // Load selected suppliers for this cotação
  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacao_fornecedores")
        .select("fornecedor_id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const fornecedores = useMemo(() => {
    if (!cotacaoFornecedores.length) return allFornecedores;
    const selectedIds = new Set(cotacaoFornecedores.map((cf: any) => cf.fornecedor_id));
    return allFornecedores.filter((f) => selectedIds.has(f.id));
  }, [allFornecedores, cotacaoFornecedores]);

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

  // Build orders per supplier with full details
  const orders = useMemo(() => {
    const result: Record<string, { produto: string; embalagem: string; quantidade: number; preco: number; total: number }[]> = {};
    fornecedores.forEach((f) => { result[f.id] = []; });

    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;

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

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendWhatsApp = (f: Fornecedor) => {
    const items = orders[f.id] || [];
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);
    const date = new Date().toLocaleDateString("pt-BR");
    let msg = `📋 *PEDIDO DE COMPRA - COTAFÁCIL*\n-----\n📦 *Fornecedor:* ${f.nome}\n📅 *Data:* ${date}\n📝 *Itens:* ${items.length}${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}\n-----\n`;
    items.forEach((it, i) => {
      msg += `\n*${i + 1}. ${it.produto}*\n    Embalagem: ${it.embalagem}\n    Qtd: ${it.quantidade}\n    Preço unit.: R$ ${formatNumber(it.preco)}\n    *Subtotal: R$ ${formatNumber(it.total)}*\n`;
    });
    msg += `\n-----\n💰 *TOTAL GERAL: ${formatBRL(total)}*${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}\n-----\n_Enviado via CotaFácil_`;

    // If supplier has phone number, send directly to them
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-5 pb-20">
      <h1 className="text-xl font-bold mb-1">Pedidos por Fornecedor</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Clique em <strong className="text-green-700">Enviar Pedido</strong> para enviar via WhatsApp diretamente para o fornecedor.
      </p>

      {fornecedores.map((f) => {
        const items = orders[f.id] || [];
        if (!items.length) return null;
        const total = items.reduce((s, it) => s + it.total, 0);
        const minOk = !f.pedido_minimo || f.pedido_minimo <= 0 || total >= f.pedido_minimo;
        const falta = f.pedido_minimo && f.pedido_minimo > 0 && !minOk ? f.pedido_minimo - total : 0;
        const pct = f.pedido_minimo && f.pedido_minimo > 0 ? Math.min(100, Math.round((total / f.pedido_minimo) * 100)) : 100;
        const isOpen = openCards[f.id] || false;

        return (
          <div key={f.id} className="bg-card border rounded-xl shadow-sm mb-3 overflow-hidden hover:shadow-md transition-shadow">
            {/* Min order alert */}
            {f.pedido_minimo && f.pedido_minimo > 0 && (
              <div className={`px-4 py-2.5 border-b text-sm flex items-center gap-3 flex-wrap ${minOk ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                {minOk ? (
                  <span className="text-green-700 font-bold">✅ Pedido mínimo atingido — Mín: {formatBRL(f.pedido_minimo)} · Pedido: {formatBRL(total)}</span>
                ) : (
                  <span className="flex-1 text-red-700">
                    ⚠️ <strong>Pedido mínimo não atingido!</strong> Faltam <strong>{formatBRL(falta)}</strong> para R$ {formatNumber(f.pedido_minimo)}
                    <div className="h-[3px] bg-red-500/40 rounded mt-1.5" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
            )}

            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleCard(f.id)}>
              <div>
                <div className="font-bold text-foreground">{f.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {items.length} itens
                  {f.telefone && ` · 📞 ${f.telefone}`}
                  {f.pedido_minimo && f.pedido_minimo > 0 ? ` · mín: ${formatBRL(f.pedido_minimo)}` : ""}
                  {f.prazo_pagamento ? ` · prazo: ${f.prazo_pagamento}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); sendWhatsApp(f); }}>
                  📱 Enviar Pedido
                </Button>
                <span className={`text-lg font-extrabold font-mono ${minOk ? "text-green-700" : "text-red-600"}`}>
                  {!minOk && "⚠️ "}{formatBRL(total)}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>

            {/* Collapsible body */}
            {isOpen && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground">PRODUTO</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">EMBAL</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">QT</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">PREÇO UN.</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                        <td className="px-3 py-2 font-medium">{it.produto}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{it.embalagem}</td>
                        <td className="px-3 py-2 text-center">{it.quantidade}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-green-700">R${formatNumber(it.preco)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold text-amber-700">{formatBRL(it.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted border-t-2 border-border">
                      <td colSpan={4} className="px-3 py-2 text-right font-bold text-sm">TOTAL DO PEDIDO:</td>
                      <td className="px-3 py-2 text-right font-mono font-extrabold text-green-700 text-sm">{formatBRL(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
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
