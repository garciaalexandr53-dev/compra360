import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CascadeResult } from "@/lib/scenarios";

interface Props {
  cascadeResult: CascadeResult;
}

export function PainelMovimentacoes({ cascadeResult }: Props) {
  const { boostDetails, pullDetails, discardDetails } = cascadeResult;
  const hasAny =
    boostDetails.length > 0 || pullDetails.length > 0 || discardDetails.length > 0;
  const [expanded, setExpanded] = useState(true);

  if (!hasAny) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs sm:text-sm font-semibold text-foreground">
          🔍 O que o sistema ajustou
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {expanded ? "Ocultar" : "Ver detalhes"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5">
          {boostDetails.length > 0 && (
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-2.5 space-y-2">
              <div className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-200">
                🔼 Quantidades ajustadas
              </div>
              {boostDetails.map((b, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="text-xs font-medium text-foreground break-words">
                    {b.fornecedorNome}
                  </div>
                  {b.itens.map((it, j) => (
                    <div
                      key={j}
                      className="text-xs text-muted-foreground pl-2 break-words"
                    >
                      · {it.produto}: {it.qtdOriginal} → {it.qtdNova} (+
                      {it.qtdExtra})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {pullDetails.length > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-2.5 space-y-2">
              <div className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200">
                🔀 Itens redistribuídos
              </div>
              {pullDetails.map((p, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="text-xs text-foreground break-words">
                    · {p.produto}
                  </div>
                  <div className="text-xs text-muted-foreground pl-2 break-words">
                    {p.fornecedorOrigem} → {p.fornecedorDestino}
                  </div>
                </div>
              ))}
            </div>
          )}

          {discardDetails.length > 0 && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-2.5 space-y-1">
              <div className="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-200">
                🚫 Fornecedores removidos
              </div>
              {discardDetails.map((d, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground break-words"
                >
                  · {d.fornecedorNome} — sem alternativa viável
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PainelMovimentacoes;
