import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, CheckCheck, AlertTriangle, ChevronRight, Minus, Plus, ArrowLeft, Package, Camera, Loader2, XCircle, AlertCircle, Filter } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { getCotacaoNome, getCotacaoEmbalagem } from "@/lib/buscaProdutos";
import { normalizarLinhaNf, descreverConversao } from "@/lib/ocrUnidade";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ConferenciaItem {
  produto_nome: string;
  embalagem: string;
  fator: number;
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
  loja_id: string | null;
  items: ConferenciaItem[];
}

type OcrStatus = "correto" | "divergencia" | "unidade_indefinida" | "faltando";

/** Metadados do OCR por índice do item do pedido. */
interface OcrMeta {
  matched: boolean;
  unidade: string | null;
  convertido: boolean;
  unidadeIndefinida: boolean;
  precoOriginal: number | null;
  qtdOriginal: number | null;
}

interface OcrExtra {
  produto_nome: string;
  qtd_nf: number | null;
  preco_nf: number | null;
  unidade: string | null;
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
  const [ocrMeta, setOcrMeta] = useState<Record<number, OcrMeta> | null>(null);
  const [ocrExtras, setOcrExtras] = useState<OcrExtra[]>([]);
  const [ocrTotalNf, setOcrTotalNf] = useState<number | null>(null);
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
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

      const ocrItems: { produto: string; unidade?: string | null; quantidade: number; preco_unitario: number }[] =
        data.result || [];
      if (!ocrItems.length) {
        toast.warning("Nenhum item encontrado na nota fiscal.");
        return;
      }

      // Match OCR items to conference items by fuzzy name
      let matched = 0;
      const updatedItems = [...items];
      const meta: Record<number, OcrMeta> = {};
      const extras: OcrExtra[] = [];
      const matchedIndices = new Set<number>();
      let indefinidos = 0;

      const nomesPedido = updatedItems.map((it) => it.produto_nome);

      for (const ocr of ocrItems) {
        const idx = encontrarMelhorMatch(ocr.produto || "", nomesPedido, matchedIndices);


        if (idx >= 0) {
          matchedIndices.add(idx);
          matched++;

          const norm = normalizarLinhaNf(
            { unidade: ocr.unidade, quantidade: ocr.quantidade, preco_unitario: ocr.preco_unitario },
            updatedItems[idx].fator || 1,
          );
          if (norm.quantidade != null) updatedItems[idx].quantidade_recebida = norm.quantidade;
          if (norm.preco_unitario != null) updatedItems[idx].preco_nf = norm.preco_unitario;
          if (norm.unidadeIndefinida) indefinidos++;

          meta[idx] = {
            matched: true,
            unidade: norm.unidade,
            convertido: norm.convertido,
            unidadeIndefinida: norm.unidadeIndefinida,
            precoOriginal: norm.precoOriginal,
            qtdOriginal: norm.quantidadeOriginal,
          };
        } else {
          extras.push({
            produto_nome: ocr.produto,
            qtd_nf: ocr.quantidade ?? null,
            preco_nf: ocr.preco_unitario ?? null,
            unidade: ocr.unidade ?? null,
          });
        }
      }

      // Items in order but not in NF
      updatedItems.forEach((item, i) => {
        if (!matchedIndices.has(i)) {
          meta[i] = {
            matched: false,
            unidade: null,
            convertido: false,
            unidadeIndefinida: false,
            precoOriginal: null,
            qtdOriginal: null,
          };
          updatedItems[i].quantidade_recebida = 0;
        }
      });

      // Calculate NF total (valores como aparecem na nota)
      const nfTotal = ocrItems.reduce((sum, ocr) => sum + (ocr.preco_unitario || 0) * (ocr.quantidade || 1), 0);

      setItems(updatedItems);
      setOcrMeta(meta);
      setOcrExtras(extras);
      setOcrTotalNf(nfTotal);
      toast.success(
        `OCR: ${matched} de ${ocrItems.length} itens identificados` +
          (indefinidos > 0 ? ` · ${indefinidos} sem unidade na nota` : ""),
      );
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
        .select("id, numero, total, created_at, fornecedor_id, loja_id, fornecedores(nome)")
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
        loja_id: p.loja_id || null,
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
    const progress = loadProgress();
    if (progress && progress.pedidoId === pedido.id) {
      setItems(progress.items);
      setNome(progress.nome);
      setSelectedPedido({ ...pedido, items: progress.items });
      return;
    }

    const { data: pedidoFull } = await supabase
      .from("pedidos")
      .select("cotacao_id")
      .eq("id", pedido.id)
      .single();

    if (!pedidoFull) return;

    const { data: cotacaoProdutos } = await supabase
      .from("cotacao_produtos")
      .select("id, quantidade, fator_embalagem, tipo_embalagem, nome, produto_id, produtos(nome, embalagem)")
      .eq("cotacao_id", pedidoFull.cotacao_id);

    const { data: precos } = await supabase
      .from("precos")
      .select("cotacao_produto_id, preco")
      .eq("fornecedor_id", pedido.fornecedor_id);

    const precosMap = new Map((precos || []).map((p: any) => [p.cotacao_produto_id, p.preco]));

    const orderItems: ConferenciaItem[] = (cotacaoProdutos || [])
      .filter((cp: any) => precosMap.has(cp.id) && precosMap.get(cp.id) != null)
      .map((cp: any) => ({
        produto_nome: getCotacaoNome(cp),
        embalagem: getCotacaoEmbalagem(cp),
        fator: cp.fator_embalagem || 1,
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

  // FONTE ÚNICA DE VERDADE: um status por item do pedido.
  // Relatório OCR, selos de contagem e aviso amarelo leem daqui.
  const statusDoItem = (item: ConferenciaItem, i: number): OcrStatus => {
    const m = ocrMeta?.[i];
    if (m) {
      if (!m.matched) return "faltando";
      if (m.unidadeIndefinida) return "unidade_indefinida";
    }
    return hasDivergencia(item) ? "divergencia" : "correto";
  };

  const statusPorItem = items.map(statusDoItem);
  const contarStatus = (s: OcrStatus) => statusPorItem.filter((x) => x === s).length;
  const totalDivergencias = contarStatus("divergencia");

  const finalizarConferencia = async () => {
    if (!selectedPedido || !nome.trim()) {
      toast.error("Informe seu nome para finalizar!");
      return;
    }

    try {
      const conferenceItems = items.map((item) => ({
        produto_nome: item.produto_nome,
        embalagem: item.embalagem,
        quantidade_pedida: item.quantidade_pedida,
        quantidade_recebida: item.quantidade_recebida,
        preco_cotado: item.preco_cotado,
        preco_nf: item.preco_nf,
      }));

      const { data, error } = await supabase.functions.invoke("complete-conferencia", {
        body: {
          pedido_id: selectedPedido.id,
          conferido_por: nome.trim(),
          observacoes: totalDivergencias > 0 ? `${totalDivergencias} divergência(s) encontrada(s)` : "Sem divergências",
          items: conferenceItems,
          loja_id: selectedPedido.loja_id || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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

  const clearOcr = () => {
    setOcrMeta(null);
    setOcrExtras([]);
    setOcrTotalNf(null);
  };

  const resetConferencia = () => {
    clearProgress();
    setSelectedPedido(null);
    setItems([]);
    setShowFaltantes(false);
    setFaltantes([]);
    setConferenciaDone(false);
    clearOcr();
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
    const pedidoTotal = selectedPedido.total || 0;
    const totalDiff = ocrTotalNf !== null ? ocrTotalNf - pedidoTotal : null;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedPedido(null); setItems([]); clearOcr(); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-bold">Pedido #{selectedPedido.numero}</h2>
            <p className="text-xs text-muted-foreground">{selectedPedido.fornecedor}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            className="text-xs gap-1.5"
          >
            {ocrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            OCR NF
          </Button>
          <Button size="sm" variant="outline" onClick={markAllCorrect} className="text-xs gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            Tudo correto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleOcrUpload}
          />
        </div>

        {/* OCR Comparison Report */}
        {ocrMeta && (
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">📋 Relatório OCR</h3>
              <button onClick={clearOcr} className="text-xs text-muted-foreground hover:text-foreground">✕ fechar</button>
            </div>

            {/* Value comparison */}
            {totalDiff !== null && (
              <div className={`rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 justify-between ${
                Math.abs(totalDiff) < 0.01 ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30"
              }`}>
                <span className="text-muted-foreground text-xs">Total NF: <span className="font-bold text-foreground">{formatBRL(ocrTotalNf!)}</span></span>
                <span className="text-muted-foreground text-xs">Total Pedido: <span className="font-bold text-foreground">{formatBRL(pedidoTotal)}</span></span>
                {Math.abs(totalDiff) >= 0.01 && (
                  <span className={`text-xs font-bold ${totalDiff > 0 ? "text-red-600" : "text-amber-600"}`}>
                    {totalDiff > 0 ? "+" : ""}{formatBRL(totalDiff)}
                  </span>
                )}
              </div>
            )}

            {/* Status summary — mesma fonte dos cartões */}
            <div className="flex gap-2 flex-wrap">
              {[
                { status: "correto" as OcrStatus, label: "Correto", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: "✅" },
                { status: "divergencia" as OcrStatus, label: "Divergência", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "⚠️" },
                { status: "unidade_indefinida" as OcrStatus, label: "Confira a unidade", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: "❓" },
                { status: "faltando" as OcrStatus, label: "Faltando", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: "🔴" },
              ].map(({ status, label, color, icon }) => {
                const count = contarStatus(status);
                if (count === 0) return null;
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                    {icon} {count} {label}
                  </span>
                );
              })}
              <span className="text-[11px] text-muted-foreground self-center">
                de {items.length} item(ns) do pedido
              </span>
            </div>

            {/* Item list */}
            <ScrollArea className="max-h-[220px]">
              <div className="space-y-1.5">
                {items.map((item, i) => {
                  const status = statusPorItem[i];
                  const m = ocrMeta[i];
                  const conversao = m?.convertido
                    ? descreverConversao({
                        quantidade: item.quantidade_recebida,
                        preco_unitario: item.preco_nf,
                        convertido: true,
                        unidadeIndefinida: false,
                        unidade: m.unidade,
                        quantidadeOriginal: m.qtdOriginal,
                        precoOriginal: m.precoOriginal,
                      })
                    : null;
                  return (
                    <div key={i} className={`px-2 py-1.5 rounded-md text-xs ${
                      status === "correto" ? "bg-green-50/50 dark:bg-green-950/10" :
                      status === "divergencia" ? "bg-amber-50/50 dark:bg-amber-950/10" :
                      status === "unidade_indefinida" ? "bg-blue-50/50 dark:bg-blue-950/10" :
                      "bg-purple-50/50 dark:bg-purple-950/10"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">
                          {status === "correto" ? "✅" : status === "divergencia" ? "⚠️" : status === "unidade_indefinida" ? "❓" : "🔴"}
                        </span>
                        <span className="flex-1 font-medium truncate">{item.produto_nome}</span>
                        {status === "divergencia" && (
                          <span className="text-amber-600 shrink-0">Ped:{item.quantidade_pedida} → NF:{item.quantidade_recebida}</span>
                        )}
                        {status === "faltando" && (
                          <span className="text-purple-600 shrink-0">Pedido: {item.quantidade_pedida}</span>
                        )}
                        {status === "unidade_indefinida" && (
                          <span className="text-blue-600 shrink-0">Confira a unidade</span>
                        )}
                      </div>
                      {conversao && (
                        <div className="pl-6 mt-0.5 text-[11px] text-muted-foreground break-words">
                          {conversao}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Linhas da nota que não estão no pedido (não entram na contagem acima) */}
            {ocrExtras.length > 0 && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10 p-2 space-y-1">
                <div className="text-xs font-semibold text-red-700 dark:text-red-400">
                  ❌ Na nota, fora do pedido ({ocrExtras.length})
                </div>
                {ocrExtras.map((x, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground break-words">
                    · {x.produto_nome} — NF: {x.qtd_nf ?? "?"} {x.unidade ?? ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divergence counter */}
        {totalDivergencias > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              {totalDivergencias} divergência(s) encontrada(s)
            </span>
          </div>
        )}



        {/* Items list */}
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-3">
            {items.map((item, i) => {
              const status = statusPorItem[i];
              const isDivergent = status === "divergencia";
              const m = ocrMeta?.[i];
              const conversaoItem = m?.convertido
                ? descreverConversao({
                    quantidade: item.quantidade_recebida,
                    preco_unitario: item.preco_nf,
                    convertido: true,
                    unidadeIndefinida: false,
                    unidade: m.unidade,
                    quantidadeOriginal: m.qtdOriginal,
                    precoOriginal: m.precoOriginal,
                  })
                : null;
              return (
                <div
                  key={i}
                  className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${
                    isDivergent ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{item.produto_nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.embalagem}
                        {item.fator > 1 && <span className="ml-1 font-mono text-[10px] text-primary">×{item.fator}</span>}
                      </div>
                      {conversaoItem && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                          {conversaoItem}
                        </div>
                      )}
                      {status === "unidade_indefinida" && (
                        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          ❓ Confira a unidade da nota
                        </span>
                      )}
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
                      {item.fator > 1 && (
                        <span className="ml-1 text-muted-foreground">({item.quantidade_pedida * item.fator} un)</span>
                      )}
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
                          item.quantidade_recebida !== item.quantidade_pedida ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : ""
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
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
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
  const fornecedoresUnicos = [...new Set(pedidos.map((p: any) => p.fornecedor))].sort();
  const pedidosFiltrados = filtroFornecedor === "todos"
    ? pedidos
    : pedidos.filter((p: any) => p.fornecedor === filtroFornecedor);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    return `${days} dias atrás`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">Conferência de Pedidos</h2>
          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {pedidos.length}
          </span>
        </div>
      </div>

      {/* Filtro por fornecedor */}
      {fornecedoresUnicos.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filtrar fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {fornecedoresUnicos.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="text-center py-12 px-4">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          {pedidos.length > 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pedido para este fornecedor</p>
          ) : (
            <>
              <h3 className="text-sm font-semibold mb-1.5">
                A conferência aparece aqui quando o pedido chegar
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-sm mx-auto">
                Depois de fechar uma cotação, o pedido entra nesta aba. Sua equipe confere o que foi
                entregue contra o que foi pedido — e o sistema aponta divergências de quantidade e preço.
              </p>
            </>
          )}
        </div>
      ) : (
        pedidosFiltrados.map((pedido: any) => (
          <button
            key={pedido.id}
            onClick={() => loadPedidoDetails(pedido)}
            className="w-full bg-card border rounded-xl p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Pedido #{pedido.numero}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                  {formatTimeAgo(pedido.created_at)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{pedido.fornecedor}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">
                {formatBRL(pedido.total)}
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
