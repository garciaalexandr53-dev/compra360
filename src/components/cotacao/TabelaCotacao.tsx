import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRL, formatNumber } from "@/lib/format";
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
  isHighVariation: (val: number, allVals: number[]) => boolean;
  isLowVariation: (val: number, allVals: number[]) => boolean;
  onPriceChange: (cpId: string, fornecedorId: string, value: string) => void;
  onPriceBlur: (cpId: string, fornecedorId: string) => void;
  onFieldBlur: (cpId: string, field: string, value: string, original: string) => void;
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
  isHighVariation,
  isLowVariation,
  onPriceChange,
  onPriceBlur,
  onFieldBlur,
}: TabelaCotacaoProps) => {
  return (
    <>
      {/* Legend */}
      {legendVisible && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/50 border-b text-[10px] flex-wrap">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">Legenda:</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-blue-600 font-extrabold text-[10px]">R$0,00</span> Menor preço
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span> Empate
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-amber-500 text-white text-[7px] font-extrabold px-1 rounded">2º</span> Segundo menor
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded">▲</span> +25% acima
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="bg-gradient-to-r from-red-500 to-red-700 text-white text-[7px] font-extrabold px-1 rounded">▼</span> -15% abaixo (discrepância)
          </span>
          <button onClick={onLegendClose} className="ml-auto text-muted-foreground hover:text-foreground">✕ ocultar</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap sticky left-0 bg-muted z-20">
                Produto
              </th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-16">Embal</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-14">QT</th>
              {fornecedores.map((f) => {
                const hasPrice = precos.some((p) => p.fornecedor_id === f.id && p.preco !== null && p.preco > 0);
                return (
                  <th key={f.id} className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border whitespace-nowrap min-w-[100px]">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${hasPrice ? "bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,.2)]" : "bg-muted-foreground/30"}`} />
                      <span>{f.nome}</span>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-blue-600 border-b-2 border-border">MIN</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700 border-b-2 border-border">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={fornecedores.length + 5} className="text-center py-10 text-muted-foreground">
                {filterAnomalies ? "Nenhum item com anomalia de preço detectada." : cotacaoProdutosCount === 0 ? "Nenhum produto na cotação. Adicione produtos pelo Banco de Produtos." : "Nenhum produto encontrado."}
              </td></tr>
            ) : filteredItems.map((cp) => {
              const info = analyzePrices(cp.id);
              const totalLine = info.minVal !== null ? info.minVal * (cp.quantidade || 1) : null;

              return (
                <tr key={cp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 border-b font-medium text-foreground whitespace-nowrap sticky left-0 bg-card z-10">
                    <Input
                      className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent w-full min-w-[120px]"
                      defaultValue={cp.produto?.nome || ""}
                      onBlur={(e) => onFieldBlur(cp.id, "nome", e.target.value, cp.produto?.nome || "")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-16 mx-auto"
                      defaultValue={cp.produto?.embalagem || "un"}
                      onBlur={(e) => onFieldBlur(cp.id, "embalagem", e.target.value, cp.produto?.embalagem || "un")}
                    />
                  </td>
                  <td className="px-1 py-2 border-b text-center">
                    <Input
                      className="h-7 text-xs text-center border-transparent hover:border-input focus:border-input bg-transparent w-14 mx-auto"
                      type="number"
                      defaultValue={cp.quantidade || 1}
                      onBlur={(e) => onFieldBlur(cp.id, "quantidade", e.target.value, String(cp.quantidade || 1))}
                    />
                  </td>
                  {fornecedores.map((f) => {
                    const rawVal = localPrices[cp.id]?.[f.id]?.replace(",", ".").replace(/[^0-9.]/g, "");
                    const numVal = rawVal ? parseFloat(rawVal) : null;
                    const isMin = numVal !== null && info.minVal !== null && numVal === info.minVal;
                    const isTieMin = isMin && info.tiedCount > 1;
                    const isSecond = info.second === f.id;
                    const hiVar = numVal !== null && isHighVariation(numVal, info.allVals);
                    const loVar = numVal !== null && isLowVariation(numVal, info.allVals);

                    let inputClass = "w-20 text-right font-mono text-xs h-8 px-2";
                    if (isMin) inputClass += " font-bold text-blue-600 border-blue-200 bg-blue-50/50";
                    else if (isSecond) inputClass += " price-second";
                    if (hiVar && !isMin) inputClass += " price-high-var";
                    if (loVar && !isMin) inputClass += " price-low-var";

                    return (
                      <td key={f.id} className="px-1 py-1 border-b text-center">
                        <div className="relative inline-flex items-center">
                          <Input
                            type="text"
                            placeholder="—"
                            value={localPrices[cp.id]?.[f.id] || ""}
                            onChange={(e) => onPriceChange(cp.id, f.id, e.target.value)}
                            onBlur={() => onPriceBlur(cp.id, f.id)}
                            className={inputClass}
                          />
                          {isTieMin && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] text-white text-[6.5px] font-extrabold px-1 rounded">EMP</span>}
                          {isSecond && <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[6px] font-extrabold px-1 rounded">2º</span>}
                          {hiVar && !isMin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="absolute -bottom-1.5 -right-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▲</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p className="font-bold">⚠️ Preço muito acima da média</p>
                                <p className="text-[11px] mt-1">+25% acima dos demais fornecedores. Verifique se há erro de digitação.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {loVar && !isMin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="absolute -bottom-1.5 -left-1 bg-gradient-to-r from-red-500 to-red-700 text-white text-[7px] font-extrabold px-1 rounded cursor-help">▼</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p className="font-bold">⚠️ Discrepância de preço</p>
                                <p className="text-[11px] mt-1">-15% abaixo da média. Verifique possível erro de digitação ou unidade.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-blue-600">
                    {info.minVal !== null ? `R$${formatNumber(info.minVal)}` : "-"}
                  </td>
                  <td className="px-3 py-2 border-b text-right font-mono text-xs font-bold text-amber-700">
                    {totalLine !== null ? formatBRL(totalLine) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total bar */}
      <div className="border-t bg-card px-5 py-3 flex items-center justify-end gap-4 shadow-[0_-4px_20px_rgba(15,20,34,.08)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total da Compra</span>
        <span className="text-xl font-extrabold text-blue-600 font-mono tracking-tight">{formatBRL(grandTotal)}</span>
      </div>
    </>
  );
};

export default TabelaCotacao;
