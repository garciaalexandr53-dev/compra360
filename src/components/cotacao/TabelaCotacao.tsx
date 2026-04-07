import { useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Phone, Mail } from "lucide-react";
import { formatBRL, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;
type Produto = Tables<"produtos"> & { categorias?: { nome: string } | null };

interface CotacaoProduto {
  id: string;
  produto_id: string;
  cotacao_id: string;
  quantidade: number | null;
  produto?: Produto;
}

interface Preco {
  id: string;
  cotacao_produto_id: string;
  fornecedor_id: string;
  preco: number | null;
}

interface PriceAnalysis {
  min: string | null;
  second: string | null;
  minVal: number | null;
  tiedCount: number;
  allVals: number[];
}

interface TabelaCotacaoProps {
  filteredItems: CotacaoProduto[];
  fornecedores: Fornecedor[];
  precos: Preco[];
  localPrices: Record<string, Record<string, string>>;
  filterAnomalies: boolean;
  cotacaoProdutosCount: number;
  grandTotal: number;
  legendVisible: boolean;
  onLegendClose: () => void;
  analyzePrices: (cpId: string) => PriceAnalysis;
  getHistAlert: (produtoId: string, val: number) => "high" | "low" | null;
  getIntraAnomaly: (cpId: string, val: number) => "high" | null;
  historicalAvgMap: Record<string, { avg: number; count: number }>;
  onPriceChange: (cpId: string, fornecedorId: string, value: string) => void;
  onPriceBlur: (cpId: string, fornecedorId: string) => void;
  onFieldBlur: (cpId: string, field: string, value: string, original: string) => void;
  onDeleteItem: (cpId: string) => void;
  isReviewMode?: boolean;
}

const TabelaCotacao = ({
  filteredItems,
  fornecedores,
  precos,
  localPrices,
  filterAnomalies,
  cotacaoProdutosCount,
  grandTotal,
  legendVisible,
  onLegendClose,
  analyzePrices,
  getHistAlert,
  getIntraAnomaly,
  historicalAvgMap,
  onPriceChange,
  onPriceBlur,
  onFieldBlur,
  onDeleteItem,
  isReviewMode = false,
}: TabelaCotacaoProps) => {
  const toastedRef = useRef<Set<string>>(new Set());
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ cpId: string; nome: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supplierHasResponded = (fId: string) =>
    precos.some((p) => p.fornecedor_id === fId && p.preco !== null && p.preco > 0);

  const handleDeleteClick = (cpId: string, nome: string) => {
    setDeleteConfirm({ cpId, nome });
  };

  const handleLongPressStart = useCallback((cpId: string, nome: string) => {
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      handleDeleteClick(cpId, nome);
    }, 600);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  return (
    <>
      {/* Legend */}
      {legendVisible && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/50 border-b text-[10px] flex-wrap">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">Legenda:</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-[hsl(var(--brand-light))] font-extrabold text-[10px]">R$0,00</span> Menor preço
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span> Empate
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-amber-500 text-white text-[7px] font-extrabold px-1 rounded">2º</span> Segundo menor
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm">⚠️</span> Abaixo do histórico
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-sm">🔴</span> Acima do histórico
          </span>
          <button onClick={onLegendClose} className="ml-auto text-muted-foreground hover:text-foreground">✕ ocultar</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border whitespace-nowrap sticky left-0 bg-muted z-20">
                Produto
              </th>
              <th className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border w-14">Emb</th>
              <th className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border w-16">Qt</th>
              {fornecedores.map((f) => {
                const hasPrice = supplierHasResponded(f.id);
                return (
                  <th key={f.id} className="px-1 py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border whitespace-nowrap min-w-[80px]">
                    {isReviewMode ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center justify-center gap-1 w-full hover:text-foreground transition-colors">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasPrice ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                            <span className="truncate max-w-[70px]">{f.nome}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="center">
                          <p className="font-semibold text-sm text-foreground">{f.nome}</p>
                          {f.telefone && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                              <Phone className="h-3.5 w-3.5" /> {f.telefone}
                            </p>
                          )}
                          {f.email && (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Mail className="h-3.5 w-3.5" /> {f.email}
                            </p>
                          )}
                          <div className="mt-2 pt-2 border-t">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${hasPrice ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                              <span className={`w-2 h-2 rounded-full ${hasPrice ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                              {hasPrice ? "Respondeu" : "Aguardando resposta"}
                            </span>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasPrice ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                        <span className="truncate max-w-[70px]">{f.nome}</span>
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-primary border-b border-border">Min</th>
              <th className="px-2 py-2 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={fornecedores.length + 5} className="text-center py-10 text-muted-foreground">
                {filterAnomalies ? "Nenhum item com anomalia de preço detectada." : cotacaoProdutosCount === 0 ? (
                  isReviewMode ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                      <div className="text-4xl">📦</div>
                      <p className="text-base font-semibold text-foreground">Nenhum item na cotação</p>
                      <p className="text-sm text-muted-foreground">Volte para adicionar produtos antes de revisar.</p>
                    </div>
                  ) : "Nenhum produto na cotação. Adicione produtos pelo Banco de Produtos."
                ) : "Nenhum produto encontrado."}
              </td></tr>
            ) : filteredItems.map((cp, rowIndex) => {
              const info = analyzePrices(cp.id);
              const totalLine = info.minVal !== null ? info.minVal * (cp.quantidade || 1) : null;
              const qtyValue = qtyDrafts[cp.id] ?? String(cp.quantidade || 1);

              return (
                <tr
                  key={cp.id}
                  className="hover:bg-muted/30 transition-colors group"
                  style={isReviewMode ? { animation: `fadeInUp 0.3s ease-out ${rowIndex * 0.04}s both` } : undefined}
                >
                  <td className="px-2 py-1.5 border-b border-border/50 font-medium text-foreground sticky left-0 bg-card z-10">
                    <button
                      className="h-auto min-h-[32px] text-xs font-medium text-left w-full min-w-[175px] sm:min-w-[200px] px-2 rounded hover:bg-muted/50 active:bg-muted/70 transition-colors cursor-default select-none whitespace-normal break-words leading-tight py-1"
                      onTouchStart={() => handleLongPressStart(cp.id, cp.produto?.nome || "produto")}
                      onTouchEnd={handleLongPressEnd}
                      onTouchCancel={handleLongPressEnd}
                      onMouseDown={() => handleLongPressStart(cp.id, cp.produto?.nome || "produto")}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {cp.produto?.nome || "Produto"}
                    </button>
                  </td>
                  <td className="px-1 py-1.5 border-b border-border/50 text-center">
                    <Input
                      className="h-8 text-[11px] text-center border-transparent hover:border-input focus:border-input bg-transparent w-14 mx-auto rounded-none shadow-none ring-0 focus-visible:ring-1 text-muted-foreground"
                      defaultValue={cp.produto?.embalagem || "un"}
                      onBlur={(e) => onFieldBlur(cp.id, "embalagem", e.target.value, cp.produto?.embalagem || "un")}
                    />
                  </td>
                  <td className="px-1 py-1.5 border-b border-border/50 text-center">
                    <Input
                      className={`${isReviewMode ? "h-10 text-sm font-semibold bg-muted/30 border-primary/20 focus:border-primary" : "h-8 text-[11px] border-transparent hover:border-input focus:border-input bg-transparent"} text-center w-16 mx-auto rounded-md shadow-none ring-0 focus-visible:ring-1 text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      type="number"
                      min={1}
                      value={qtyValue}
                      onFocus={(e) => {
                        setQtyDrafts(s => ({ ...s, [cp.id]: "" }));
                        e.target.select();
                      }}
                      onChange={(e) => setQtyDrafts(s => ({ ...s, [cp.id]: e.target.value }))}
                      onBlur={(e) => {
                        const val = Math.max(1, Number(e.target.value) || cp.quantidade || 1);
                        onFieldBlur(cp.id, "quantidade", String(val), String(cp.quantidade || 1));
                        setQtyDrafts(s => { const n = { ...s }; delete n[cp.id]; return n; });
                      }}
                    />
                  </td>
                  {fornecedores.map((f) => {
                    const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
                    const numVal = rawVal ? parseFloat(rawVal) : null;
                    const isMin = numVal !== null && info.minVal !== null && numVal === info.minVal;
                    const isTieMin = isMin && info.tiedCount > 1;
                    const isSecond = info.second === f.id;
                    const histAlert = numVal !== null ? getHistAlert(cp.produto_id, numVal) : null;
                    const intraAlert = numVal !== null ? getIntraAnomaly(cp.id, numVal) : null;

                    // Check if this price was manually edited (exists in DB vs what's shown)
                    const cellKey = `${cp.id}-${f.id}`;
                    if (histAlert === "low" && !toastedRef.current.has(cellKey)) {
                      toastedRef.current.add(cellKey);
                      setTimeout(() => {
                        toast.warning(`⚠️ Preço de ${cp.produto?.nome || "produto"} parece muito baixo — confirme com o fornecedor`, { duration: 6000 });
                      }, 100);
                    }

                    let inputClass = "w-20 text-right font-mono text-xs h-8 px-1 border-transparent bg-transparent rounded-none shadow-none ring-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-muted/30";
                    if (isMin) inputClass += " price-best";
                    else if (isSecond && !isMin) inputClass += " price-second";
                    else if (numVal !== null) inputClass += " text-foreground";
                    else inputClass += " text-muted-foreground/40";

                    const hist = historicalAvgMap[cp.produto_id];

                    return (
                      <td key={f.id} className="px-0.5 py-1 border-b border-border/50 text-center">
                        <div className="relative inline-flex items-center">
                          <Input
                            type="text"
                            placeholder="—"
                            value={localPrices[cp.id]?.[f.id] || ""}
                            onChange={(e) => onPriceChange(cp.id, f.id, e.target.value)}
                            onBlur={() => onPriceBlur(cp.id, f.id)}
                            onFocus={(e) => e.target.select()}
                            className={inputClass}
                            title={isReviewMode ? "Toque para corrigir o preço" : undefined}
                          />
                          {isTieMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span>}
                          {isSecond && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[6px] font-extrabold px-1 rounded">2º</span>}
                          {histAlert === "low" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="absolute -bottom-1.5 -right-1 text-[11px] cursor-help leading-none">⚠️</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p className="font-bold">⚠️ Preço muito abaixo do histórico</p>
                                <p className="text-[11px] mt-1">
                                  Média histórica: R${formatNumber(hist?.avg || 0)} ({hist?.count || 0} cotações).
                                  Possível erro de digitação.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {histAlert === "high" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="absolute -bottom-1.5 -right-1 text-[11px] cursor-help leading-none">🔴</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p className="font-bold">🔴 Preço acima do histórico</p>
                                <p className="text-[11px] mt-1">
                                  Média histórica: R${formatNumber(hist?.avg || 0)} ({hist?.count || 0} cotações).
                                  Preço significativamente acima do habitual.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-green-700 dark:text-emerald-400">
                    {info.minVal !== null ? `R$${formatNumber(info.minVal)}` : "-"}
                  </td>
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                    {totalLine !== null ? formatBRL(totalLine) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total bar — hidden in review mode since ReviewFooter replaces it */}
      {!isReviewMode && (
        <div className="border-t bg-card px-5 py-3 flex items-center justify-end gap-4 shadow-[0_-4px_20px_rgba(15,20,34,.08)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total da Compra</span>
          <span className="text-xl font-extrabold text-blue-600 font-mono tracking-tight">{formatBRL(grandTotal)}</span>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover <strong>{deleteConfirm?.nome}</strong> da cotação? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) onDeleteItem(deleteConfirm.cpId);
                setDeleteConfirm(null);
              }}
            >
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TabelaCotacao;
