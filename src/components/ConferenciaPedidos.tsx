import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Check, CheckCheck, AlertTriangle, ChevronRight, Minus, Plus, ArrowLeft, Package, Camera, Loader2 } from "lucide-react";

interface ConferenciaItem {
  produto_nome: string;
  embalagem: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  preco_cotado: number | null;
  preco_nf: number | null;
}

interface PedidoWithDetails {
  id: string;
  numero: number;
  fornecedor: string;
  fornecedor_id: string;
  total: number;
  created_at: string;
  items: ConferenciaItem[];
}

const STORAGE_KEY = "conferencia_progress";

const loadProgress = (): { pedidoId: string; items: ConferenciaItem[]; nome: string } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveProgress = (pedidoId: string, items: ConferenciaItem[], nome: string) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ pedidoId, items, nome }));
};

const clearProgress = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const ConferenciaPedidos = () => {
  const [selectedPedido, setSelectedPedido] = useState<PedidoWithDetails | null>(null);
  const [items, setItems] = useState<ConferenciaItem[]>([]);
  const [nome, setNome] = useState("");
  const [showFaltantes, setShowFaltantes] = useState(false);
  const [faltantes, setFaltantes] = useState<{ nome: string; qtd: number }[]>([]);
  const [conferenciaDone, setConferenciaDone] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setOcrLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("ocr-nota-fiscal", {
        body: { image_base64: base64, mode: "conferencia" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const ocrItems: { produto: string; quantidade: number; preco_unitario: number }[] = data.result || [];
      if (!ocrItems.length) {
        toast.warning("Nenhum item encontrado na nota fiscal.");
        return;
      }

      // Match OCR items to conference items by fuzzy name
      let matched = 0;
      const updatedItems = [...items];
      for (const ocr of ocrItems) {
        const ocrName = (ocr.produto || "").toLowerCase().trim();
        const idx = updatedItems.findIndex((item) => {
          const itemName = item.produto_nome.toLowerCase().trim();
          return itemName.includes(ocrName) || ocrName.includes(itemName) ||
            itemName.split(" ").some(w => w.length > 3 && ocrName.includes(w));
        });
        if (idx >= 0) {
          if (ocr.quantidade != null) updatedItems[idx].quantidade_recebida = ocr.quantidade;
          if (ocr.preco_unitario != null) updatedItems[idx].preco_nf = ocr.preco_unitario;
          matched++;
        }
      }

      setItems(updatedItems);
      toast.success(`OCR: ${matched} de ${ocrItems.length} itens preenchidos automaticamente`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar nota fiscal");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Fetch pedidos with status 'enviado'
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-enviados-public"],
    queryFn: async () => {
      const { data: pedidosData, error } = await supabase
        .from("pedidos")
        .select("id, numero, total, created_at, fornecedor_id, fornecedores(nome)")
        .eq("status", "enviado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (pedidosData || []).map((p: any) => ({
        id: p.id,
        numero: p.numero,
        fornecedor: p.fornecedores?.nome || "Fornecedor",
        fornecedor_id: p.fornecedor_id,
        total: p.total || 0,
        created_at: p.created_at,
      }));
    },
  });

  // Restore progress on mount
  useEffect(() => {
    if (pedidos.length === 0) return;
    const progress = loadProgress();
    if (progress) {
      const pedido = pedidos.find((p: any) => p.id === progress.pedidoId);
      if (pedido) {
        setSelectedPedido({ ...pedido, items: progress.items });
        setItems(progress.items);
        setNome(progress.nome);
        toast.info("Conferência em andamento restaurada!");
      } else {
        clearProgress();
      }
    }
  }, [pedidos]);

  // Auto-save progress whenever items or nome change
  useEffect(() => {
    if (selectedPedido && items.length > 0) {
      saveProgress(selectedPedido.id, items, nome);
    }
  }, [items, nome, selectedPedido]);

  const loadPedidoDetails = async (pedido: any) => {
    // Check if there's saved progress for this pedido
    const progress = loadProgress();
    if (progress && progress.pedidoId === pedido.id) {
      setItems(progress.items);
      setNome(progress.nome);
      setSelectedPedido({ ...pedido, items: progress.items });
      return;
    }

    // Get the cotacao_id from the pedido
    const { data: pedidoFull } = await supabase
      .from("pedidos")
      .select("cotacao_id")
      .eq("id", pedido.id)
      .single();

    if (!pedidoFull) return;

    // Get products and prices for this supplier in this cotação
    const { data: cotacaoProdutos } = await supabase
      .from("cotacao_produtos")
      .select("id, quantidade, produto_id, produtos(nome, embalagem)")
      .eq("cotacao_id", pedidoFull.cotacao_id);

    const { data: precos } = await supabase
      .from("precos")
      .select("cotacao_produto_id, preco")
      .eq("fornecedor_id", pedido.fornecedor_id);

    const precosMap = new Map((precos || []).map((p: any) => [p.cotacao_produto_id, p.preco]));

    const orderItems: ConferenciaItem[] = (cotacaoProdutos || [])
      .filter((cp: any) => precosMap.has(cp.id) && precosMap.get(cp.id) != null)
      .map((cp: any) => ({
        produto_nome: cp.produtos?.nome || "Produto",
        embalagem: cp.produtos?.embalagem || "un",
        quantidade_pedida: cp.quantidade || 1,
        quantidade_recebida: cp.quantidade || 1,
        preco_cotado: precosMap.get(cp.id) || 0,
        preco_nf: precosMap.get(cp.id) || 0,
      }));

    setItems(orderItems);
    setSelectedPedido({ ...pedido, items: orderItems });
    saveProgress(pedido.id, orderItems, nome);
  };

  const markAllCorrect = () => {
    const updated = items.map((item) => ({
      ...item,
      quantidade_recebida: item.quantidade_pedida,
      preco_nf: item.preco_cotado,
    }));
    setItems(updated);
    toast.success("Todos os itens marcados como corretos!");
  };

  const updateQtdRecebida = (index: number, delta: number) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, quantidade_recebida: Math.max(0, item.quantidade_recebida + delta) } : item
    ));
  };

  const updateQtdRecebidaInput = (index: number, val: string) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, quantidade_recebida: Math.max(0, parseInt(val) || 0) } : item
    ));
  };

  const updatePrecoNf = (index: number, val: string) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, preco_nf: parseFloat(val) || 0 } : item
    ));
  };

  const hasDivergencia = (item: ConferenciaItem) =>
    item.quantidade_recebida !== item.quantidade_pedida ||
    (item.preco_nf != null && item.preco_cotado != null && item.preco_nf !== item.preco_cotado);

  const totalDivergencias = items.filter(hasDivergencia).length;

  const finalizarConferencia = async () => {
    if (!selectedPedido || !nome.trim()) {
      toast.error("Informe seu nome para finalizar!");
      return;
    }

    try {
      const { data: conf, error: confError } = await supabase
        .from("conferencias")
        .insert({
          pedido_id: selectedPedido.id,
          conferido_por: nome.trim(),
          observacoes: totalDivergencias > 0 ? `${totalDivergencias} divergência(s) encontrada(s)` : "Sem divergências",
        })
        .select("id")
        .single();

      if (confError) throw confError;

      const insertItems = items.map((item) => ({
        conferencia_id: conf.id,
        produto_nome: item.produto_nome,
        embalagem: item.embalagem,
        quantidade_pedida: item.quantidade_pedida,
        quantidade_recebida: item.quantidade_recebida,
        preco_cotado: item.preco_cotado,
        preco_nf: item.preco_nf,
        divergencia_qtd: item.quantidade_recebida !== item.quantidade_pedida,
        divergencia_preco: item.preco_nf != null && item.preco_cotado != null && item.preco_nf !== item.preco_cotado,
      }));

      const { error: itensError } = await supabase
        .from("conferencia_itens")
        .insert(insertItems);

      if (itensError) throw itensError;

      await supabase
        .from("pedidos")
        .update({ status: "recebido" as any })
        .eq("id", selectedPedido.id);

      const itemsFaltantes = items
        .filter((item) => item.quantidade_recebida < item.quantidade_pedida)
        .map((item) => ({
          nome: item.produto_nome,
          qtd: item.quantidade_pedida - item.quantidade_recebida,
        }));

      clearProgress();

      if (itemsFaltantes.length > 0) {
        setFaltantes(itemsFaltantes);
        setShowFaltantes(true);
      } else {
        setConferenciaDone(true);
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-enviados-public"] });
      toast.success("Conferência finalizada!");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const adicionarFaltantes = async () => {
    try {
      const inserts = faltantes.map((f) => ({
        nome: f.nome,
        quantidade: f.qtd,
        registrado_por: `Conferência - ${nome.trim()}`,
      }));
      await supabase.from("itens_faltantes").insert(inserts);
      toast.success(`${faltantes.length} item(ns) adicionado(s) à lista de faltantes!`);
      setShowFaltantes(false);
      setConferenciaDone(true);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const resetConferencia = () => {
    clearProgress();
    setSelectedPedido(null);
    setItems([]);
    setShowFaltantes(false);
    setFaltantes([]);
    setConferenciaDone(false);
  };

  // Done screen
  if (conferenciaDone) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Conferência Concluída!</h2>
        <p className="text-muted-foreground mb-6">
          Pedido #{selectedPedido?.numero} de {selectedPedido?.fornecedor} foi conferido com sucesso.
        </p>
        <Button onClick={resetConferencia} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
          Voltar aos pedidos
        </Button>
      </div>
    );
  }

  // Faltantes suggestion screen
  if (showFaltantes) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Itens com Quantidade Faltante</h2>
          <p className="text-sm text-muted-foreground">
            Deseja adicionar esses itens à Lista de Itens para futura cotação?
          </p>
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          {faltantes.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
              <span className="text-sm font-medium">{f.nome}</span>
              <span className="text-sm font-bold text-amber-600">Faltando: {f.qtd}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => { setShowFaltantes(false); setConferenciaDone(true); }}>
            Ignorar
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]" onClick={adicionarFaltantes}>
            Adicionar à Lista
          </Button>
        </div>
      </div>
    );
  }

  // Conferencia detail screen
  if (selectedPedido) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedPedido(null); setItems([]); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-bold">Pedido #{selectedPedido.numero}</h2>
            <p className="text-xs text-muted-foreground">{selectedPedido.fornecedor}</p>
          </div>
          <Button size="sm" variant="outline" onClick={markAllCorrect} className="text-xs gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            Tudo correto
          </Button>
        </div>

        {/* Divergence counter */}
        {totalDivergencias > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 font-medium">
              {totalDivergencias} divergência(s) encontrada(s)
            </span>
          </div>
        )}

        {/* Items list */}
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-3">
            {items.map((item, i) => {
              const isDivergent = hasDivergencia(item);
              return (
                <div
                  key={i}
                  className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${
                    isDivergent ? "border-amber-300 bg-amber-50/50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{item.produto_nome}</div>
                      <div className="text-xs text-muted-foreground">{item.embalagem}</div>
                    </div>
                    {isDivergent ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Quantidade */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Qtd pedida: <span className="font-bold text-foreground">{item.quantidade_pedida}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Recebida:</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQtdRecebida(i, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantidade_recebida}
                        onChange={(e) => updateQtdRecebidaInput(i, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={`h-7 w-14 text-xs text-center ${
                          item.quantidade_recebida !== item.quantidade_pedida ? "border-amber-400 bg-amber-50" : ""
                        }`}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQtdRecebida(i, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Preço */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Preço cotado: <span className="font-bold text-foreground">
                        R$ {(item.preco_cotado || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Preço NF:</span>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_nf ?? ""}
                          onChange={(e) => updatePrecoNf(i, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className={`h-7 w-24 text-xs text-right pr-2 pl-7 ${
                            item.preco_nf != null && item.preco_cotado != null && item.preco_nf !== item.preco_cotado
                              ? "border-amber-400 bg-amber-50"
                              : ""
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer: name + finalize */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Seu nome (obrigatório)
            </label>
            <Input
              placeholder="Nome do conferente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button
            onClick={finalizarConferencia}
            disabled={!nome.trim()}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-base py-6 font-bold"
          >
            ✅ Finalizar Conferência
          </Button>
        </div>
      </div>
    );
  }

  // Pedidos list
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum pedido aguardando conferência</p>
        </div>
      ) : (
        pedidos.map((pedido: any) => (
          <button
            key={pedido.id}
            onClick={() => loadPedidoDetails(pedido)}
            className="w-full bg-card border rounded-xl p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Pedido #{pedido.numero}</div>
              <div className="text-xs text-muted-foreground">{pedido.fornecedor}</div>
              <div className="text-xs text-muted-foreground">
                R$ {pedido.total.toFixed(2)} · {new Date(pedido.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </button>
        ))
      )}
    </div>
  );
};

export default ConferenciaPedidos;
