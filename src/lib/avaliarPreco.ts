/**
 * Avaliação do preço digitado pelo fornecedor no portal público.
 *
 * Regra principal: comparar com uma MEDIANA de referência (vinda da RPC
 * `get_supplier_cotacao_produtos`). Divergência acima de 20% em qualquer
 * direção gera aviso. Sem referência, usa a faixa fixa antiga (<0,50 / >999)
 * como último recurso. Nunca bloqueia o envio — apenas avisa.
 */

export const TOLERANCIA_MEDIANA = 0.2;

export type ReferenciaFonte = "global" | "comprador" | null;

export interface AvaliacaoPreco {
  alerta: boolean;
  /** Como o alerta foi determinado */
  motivo: "mediana" | "faixa_fixa" | null;
  /** Mediana usada, quando houver */
  referencia: number | null;
  fonte: ReferenciaFonte;
  /** Desvio relativo em relação à mediana (0.35 = 35% acima) */
  desvio: number | null;
}

const SEM_ALERTA: AvaliacaoPreco = {
  alerta: false,
  motivo: null,
  referencia: null,
  fonte: null,
  desvio: null,
};

export function avaliarPreco(
  preco: number | null | undefined,
  referencia?: number | null,
  fonte?: ReferenciaFonte
): AvaliacaoPreco {
  if (preco == null || !Number.isFinite(preco) || preco <= 0) return SEM_ALERTA;

  if (referencia != null && Number.isFinite(referencia) && referencia > 0) {
    const desvio = (preco - referencia) / referencia;
    return {
      alerta: Math.abs(desvio) > TOLERANCIA_MEDIANA,
      motivo: "mediana",
      referencia,
      fonte: fonte ?? null,
      desvio,
    };
  }

  // Fallback histórico: faixa fixa
  const foraDaFaixa = preco < 0.5 || preco > 999;
  return {
    alerta: foraDaFaixa,
    motivo: "faixa_fixa",
    referencia: null,
    fonte: null,
    desvio: null,
  };
}
