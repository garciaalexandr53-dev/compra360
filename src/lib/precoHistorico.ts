/** Inteligência de Preço: comparação com o histórico da loja. */

export const TOLERANCIA_HISTORICO = 0.03;

export interface HistoricoPreco {
  chave: string;
  ultimo_preco: number;
  ultimo_fornecedor: string | null;
  ultima_data: string;
  media: number;
  amostras: number;
}

/** Mesma chave gerada pela RPC get_historico_precos_loja. */
export function chaveProduto(item: {
  catalogo_mestre_id?: string | null;
  ean?: string | null;
  nome?: string | null;
}): string {
  if (item.catalogo_mestre_id) return `c:${item.catalogo_mestre_id}`;
  const ean = item.ean?.trim();
  if (ean) return `e:${ean}`;
  return `n:${(item.nome ?? "").trim().toLowerCase()}`;
}

/** Variação (fração) do valor contra a referência; null se inválido. */
export function variacao(valor: number, ref: number): number | null {
  if (!Number.isFinite(valor) || !Number.isFinite(ref) || valor <= 0 || ref <= 0) return null;
  return (valor - ref) / ref;
}

export function classificar(valor: number, ref: number): "abaixo" | "acima" | "neutro" | null {
  const v = variacao(valor, ref);
  if (v === null) return null;
  if (v < -TOLERANCIA_HISTORICO) return "abaixo";
  if (v > TOLERANCIA_HISTORICO) return "acima";
  return "neutro";
}

export function formatPct(v: number | null): string {
  if (v === null) return "—";
  const s = (v * 100).toFixed(1).replace(".", ",");
  return v > 0 ? `+${s}%` : `${s}%`;
}
