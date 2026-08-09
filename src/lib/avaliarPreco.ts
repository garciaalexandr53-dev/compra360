/**
 * Avaliação do preço digitado pelo fornecedor no portal público.
 *
 * Compara com uma mediana de referência (vinda da RPC
 * `get_supplier_cotacao_produtos`). Divergência acima do limiar gera aviso.
 * Sem referência, usa a faixa fixa como último recurso.
 * Nunca bloqueia o envio — apenas avisa.
 */
import {
  LIMIAR_DIVERGENCIA_MERCADO,
  PRECO_FALLBACK_MIN,
  PRECO_FALLBACK_MAX,
} from "./precoReferencia";
import { formatNumber } from "./format";

export type ReferenciaFonte = "global" | "comprador" | null;

export interface AvaliacaoPreco {
  alerta: boolean;
  mensagem: string | null;
}

export function avaliarPreco(
  precoDigitado: number,
  precoReferencia: number | null,
  referenciaFonte: ReferenciaFonte
): AvaliacaoPreco {
  if (!Number.isFinite(precoDigitado) || precoDigitado <= 0) {
    return { alerta: false, mensagem: null };
  }

  if (precoReferencia && referenciaFonte) {
    const diffPct = Math.abs(precoDigitado - precoReferencia) / precoReferencia;
    if (diffPct > LIMIAR_DIVERGENCIA_MERCADO) {
      const origem =
        referenciaFonte === "global"
          ? `preço de mercado (R$ ${formatNumber(precoReferencia)})`
          : `preço praticado em cotações anteriores com você (R$ ${formatNumber(precoReferencia)})`;
      return {
        alerta: true,
        mensagem: `Valor fora do padrão — confirme se está correto. Referência: ${origem}`,
      };
    }
    return { alerta: false, mensagem: null };
  }

  if (precoDigitado < PRECO_FALLBACK_MIN || precoDigitado > PRECO_FALLBACK_MAX) {
    return { alerta: true, mensagem: "Valor incomum — confirme se está correto" };
  }

  return { alerta: false, mensagem: null };
}
