import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber, buildWhatsAppUrl } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronDown, Printer, FileText, Loader2, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";

type Fornecedor = Tables<"fornecedores">;

interface OrderItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  preco: number;
  total: number;
}

const PedidosContent = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [whatsappAiLoading, setWhatsappAiLoading] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptFornecedor, setReceiptFornecedor] = useState<Fornecedor | null>(null);
  const [receiptItems, setReceiptItems] = useState<OrderItem[]>([]);
  const [receiptNumero, setReceiptNumero] = useState<number | null>(null);

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("*").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data, error } = await query.limit(1).maybeSingle();
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

  const { data: cotacaoFornecedores = [] } = useQuery({
    queryKey: ["cotacao-fornecedores", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cotacao_fornecedores").select("fornecedor_id").eq("cotacao_id", cotacaoAtiva!.id);
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
      const { data, error } = await supabase.from("cotacao_produtos").select("*, produtos(*, categorias(nome))").eq("cotacao_id", cotacaoAtiva!.id);
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

  const orders = useMemo(() => {
    const result: Record<string, OrderItem[]> = {};
    fornecedores.forEach((f) => { result[f.id] = []; });

    const winCount: Record<string, number> = {};
    fornecedores.forEach((f) => { winCount[f.id] = 0; });
    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
      const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
      if (winners.length === 1) winCount[winners[0].fornecedor_id] = (winCount[winners[0].fornecedor_id] || 0) + 1;
    });

    cotacaoProdutos.forEach((cp: any) => {
      const cpPrecos = precos.filter((p: any) => p.cotacao_produto_id === cp.id && p.preco !== null && p.preco > 0);
      if (!cpPrecos.length) return;
      const minPrice = Math.min(...cpPrecos.map((p: any) => p.preco));
      const winners = cpPrecos.filter((p: any) => p.preco === minPrice);
      let best = winners[0];
      if (winners.length > 1) {
        winners.sort((a: any, b: any) => (winCount[b.fornecedor_id] || 0) - (winCount[a.fornecedor_id] || 0));
        best = winners[0];
      }
      const qt = cp.quantidade || 1;
      result[best.fornecedor_id]?.push({
        produto: cp.produtos?.nome || "?",
        embalagem: cp.produtos?.embalagem || "un",
        quantidade: qt,
        preco: best.preco ?? 0,
        total: (best.preco ?? 0) * qt,
      });
    });
    return result;
  }, [cotacaoProdutos, precos, fornecedores]);

  const toggleCard = (id: string) => setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));

  const createPedidoMutation = useMutation({
    mutationFn: async ({ fornecedorId, total }: { fornecedorId: string; total: number }) => {
      if (!cotacaoAtiva) throw new Error("Sem cotação ativa");
      const { data: existing } = await supabase.from("pedidos").select("id")
        .eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", fornecedorId)
        .limit(1).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from("pedidos").update({
          total, status: "enviado" as any, enviado_at: new Date().toISOString(),
        }).eq("id", existing.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("pedidos").insert({
        cotacao_id: cotacaoAtiva.id,
        fornecedor_id: fornecedorId,
        status: "enviado",
        total,
        enviado_at: new Date().toISOString(),
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
  });

  const sendWhatsApp = async (f: Fornecedor) => {
    const items = orders[f.id] || [];
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);

    let pedidoNumero: number | null = null;
    try {
      const pedido = await createPedidoMutation.mutateAsync({ fornecedorId: f.id, total });
      pedidoNumero = (pedido as any).numero || null;
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (e) {
      console.error("Failed to create pedido record", e);
    }

    const date = new Date().toLocaleDateString("pt-BR");
    const billingParts: string[] = [];
    if (lojaAtiva) {
      if (lojaAtiva.nome) billingParts.push(`🏪 *Loja:* ${lojaAtiva.nome}`);
      if ((lojaAtiva as any).razao_social) billingParts.push(`🏢 *Razão Social:* ${(lojaAtiva as any).razao_social}`);
      if ((lojaAtiva as any).cnpj) billingParts.push(`📄 *CNPJ:* ${(lojaAtiva as any).cnpj}`);
      if ((lojaAtiva as any).inscricao_estadual) billingParts.push(`📋 *IE:* ${(lojaAtiva as any).inscricao_estadual}`);
      if (lojaAtiva.endereco) billingParts.push(`📍 *Endereço:* ${lojaAtiva.endereco}`);
    }
    const billingBlock = billingParts.length > 0 ? `\n-----\n*DADOS PARA FATURAMENTO:*\n${billingParts.join("\n")}\n` : "";
    let msg = `📋 *PEDIDO DE COMPRA - COMPRA360*${pedidoNumero ? ` #${pedidoNumero}` : ""}\n-----\n📦 *Fornecedor:* ${f.nome}\n📅 *Data:* ${date}\n📝 *Itens:* ${items.length}${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}${billingBlock}\n-----\n`;
    items.forEach((it, i) => {
      msg += `\n*${i + 1}. ${it.produto}*\n    Embalagem: ${it.embalagem}\n    Qtd: ${it.quantidade}\n    Preço unit.: R$ ${formatNumber(it.preco)}\n    *Subtotal: R$ ${formatNumber(it.total)}*\n`;
    });
    msg += `\n-----\n💰 *TOTAL GERAL: ${formatBRL(total)}*${f.prazo_pagamento ? `\n💳 *Prazo pagamento:* ${f.prazo_pagamento}` : ""}\n-----\n_Enviado via Compra360_`;

    window.open(buildWhatsAppUrl(f.telefone, msg), "_blank");
  };

  const sendWhatsAppAi = async (f: Fornecedor) => {
    const items = orders[f.id] || [];
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    const total = items.reduce((s, it) => s + it.total, 0);
    setWhatsappAiLoading(f.id);

    let pedidoNumero: number | null = null;
    try {
      const pedido = await createPedidoMutation.mutateAsync({ fornecedorId: f.id, total });
      pedidoNumero = (pedido as any).numero || null;
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (e) {
      console.error("Failed to create pedido record", e);
    }

    try {
      const resp = await supabase.functions.invoke("ai-automacao", {
        body: {
          type: "whatsapp-message",
          fornecedor_id: f.id,
          cotacao_id: cotacaoAtiva?.id,
          loja_id: lojaAtiva?.id,
          items: items.map((it) => ({ ...it, preco: formatNumber(it.preco), total: it.total.toFixed(2) })),
        },
      });
      if (resp.error) throw new Error(resp.error.message);
      const msg = resp.data?.message || "";
      window.open(buildWhatsAppUrl(f.telefone, msg), "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar mensagem IA");
    }
    setWhatsappAiLoading(null);
  };

  const openReceipt = async (f: Fornecedor) => {
    const items = orders[f.id] || [];
    if (!items.length) { toast.error("Nenhum item para " + f.nome); return; }
    let numero: number | null = null;
    if (cotacaoAtiva) {
      const { data } = await supabase.from("pedidos").select("numero").eq("cotacao_id", cotacaoAtiva.id).eq("fornecedor_id", f.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      numero = (data as any)?.numero || null;
    }
    setReceiptFornecedor(f);
    setReceiptItems(items);
    setReceiptNumero(numero);
    setReceiptOpen(true);
  };

  const printReceipt = () => window.print();

  if (!cotacaoAtiva) {
    return <div className="py-10 text-center text-muted-foreground">Nenhuma cotação ativa.</div>;
  }

  return (
    <div className="pb-10">
      <p className="text-sm text-muted-foreground mb-4">
        Clique em <strong className="text-green-700">Enviar Pedido</strong> para WhatsApp. Use <strong className="text-blue-600">Conferência</strong> para ficha de recebimento.
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
            {f.pedido_minimo && f.pedido_minimo > 0 && (
              <div className={`px-4 py-2.5 border-b text-sm flex items-center gap-3 flex-wrap ${minOk ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                {minOk ? (
                  <span className="text-green-700 font-bold">✅ Mín. atingido — {formatBRL(f.pedido_minimo)}</span>
                ) : (
                  <span className="flex-1 text-red-700">
                    ⚠️ Faltam <strong>{formatBRL(falta)}</strong> para mín. {formatBRL(f.pedido_minimo)}
                    <div className="h-[3px] bg-red-500/40 rounded mt-1.5" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
            )}

            <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleCard(f.id)}>
              <div>
                <div className="font-bold text-foreground">{f.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {items.length} itens
                  {f.prazo_pagamento ? ` · ${f.prazo_pagamento}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openReceipt(f); }}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Conferência
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={(e) => { e.stopPropagation(); sendWhatsApp(f); }}>
                  📱 Enviar
                </Button>
                <Button size="sm" variant="outline" className="text-primary border-primary/30" onClick={(e) => { e.stopPropagation(); sendWhatsAppAi(f); }} disabled={whatsappAiLoading === f.id}>
                  {whatsappAiLoading === f.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5 mr-1" />}
                  🤖 IA
                </Button>
                <span className={`text-lg font-extrabold font-mono ${minOk ? "text-green-700" : "text-red-600"}`}>
                  {formatBRL(total)}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>

            {isOpen && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-muted-foreground">PRODUTO</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">EMBAL</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">QT</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">PREÇO</th>
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
                      <td colSpan={4} className="px-3 py-2 text-right font-bold text-sm">TOTAL:</td>
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

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-lg print:max-w-full print:shadow-none print:border-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>📋 Ficha de Conferência</DialogTitle>
          </DialogHeader>
          {receiptFornecedor && (
            <div className="space-y-4" id="receipt-content">
              <div className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">FICHA DE CONFERÊNCIA</h2>
                    <p className="text-sm text-muted-foreground">Compra360</p>
                  </div>
                  {receiptNumero && (
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Pedido Nº</span>
                      <div className="text-2xl font-extrabold font-mono text-primary">#{receiptNumero}</div>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{receiptFornecedor.nome}</strong></div>
                  <div><span className="text-muted-foreground">Data:</span> <strong>{new Date().toLocaleDateString("pt-BR")}</strong></div>
                  {receiptFornecedor.representante && (
                    <div><span className="text-muted-foreground">Representante:</span> {receiptFornecedor.representante}</div>
                  )}
                  {receiptFornecedor.prazo_pagamento && (
                    <div><span className="text-muted-foreground">Prazo:</span> {receiptFornecedor.prazo_pagamento}</div>
                  )}
                </div>
                {/* Billing data */}
                {lojaAtiva && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Dados para Faturamento</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div><span className="text-muted-foreground">Loja:</span> {lojaAtiva.nome}</div>
                      {(lojaAtiva as any).cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {(lojaAtiva as any).cnpj}</div>}
                      {(lojaAtiva as any).razao_social && <div><span className="text-muted-foreground">Razão Social:</span> {(lojaAtiva as any).razao_social}</div>}
                      {(lojaAtiva as any).inscricao_estadual && <div><span className="text-muted-foreground">IE:</span> {(lojaAtiva as any).inscricao_estadual}</div>}
                      {lojaAtiva.endereco && <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {lojaAtiva.endereco}</div>}
                    </div>
                  </div>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="py-1.5 text-left text-[10px] font-bold uppercase w-8">✓</th>
                    <th className="py-1.5 text-left text-[10px] font-bold uppercase">PRODUTO</th>
                    <th className="py-1.5 text-center text-[10px] font-bold uppercase w-14">EMBAL</th>
                    <th className="py-1.5 text-center text-[10px] font-bold uppercase w-10">QT</th>
                    <th className="py-1.5 text-right text-[10px] font-bold uppercase w-20">PREÇO</th>
                    <th className="py-1.5 text-right text-[10px] font-bold uppercase w-20">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((it, i) => (
                    <tr key={i} className="border-b border-dashed">
                      <td className="py-2"><div className="w-4 h-4 border-2 border-foreground/40 rounded-sm" /></td>
                      <td className="py-2 font-medium text-xs">{it.produto}</td>
                      <td className="py-2 text-center text-xs text-muted-foreground">{it.embalagem}</td>
                      <td className="py-2 text-center text-xs font-bold">{it.quantidade}</td>
                      <td className="py-2 text-right text-xs font-mono">R${formatNumber(it.preco)}</td>
                      <td className="py-2 text-right text-xs font-mono font-bold">{formatBRL(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/30">
                    <td colSpan={5} className="py-2 text-right font-bold">TOTAL:</td>
                    <td className="py-2 text-right font-mono font-extrabold text-lg">
                      {formatBRL(receiptItems.reduce((s, it) => s + it.total, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="border-b border-foreground/30 mb-1 h-8" />
                  <span className="text-xs text-muted-foreground">Conferido por</span>
                </div>
                <div className="text-center">
                  <div className="border-b border-foreground/30 mb-1 h-8" />
                  <span className="text-xs text-muted-foreground">Data de recebimento</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 print:hidden mt-2">
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>Fechar</Button>
            <Button onClick={printReceipt} className="bg-primary">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosContent;
