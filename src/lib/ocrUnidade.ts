/**
 * Normalização de unidade de medida lida da nota fiscal (OCR).
 *
 * A nota pode faturar por embalagem (CX, FD, DZ, PCT, DP) enquanto o pedido
 * trabalha por unidade. Aqui convertemos preço/quantidade para "por unidade"
 * usando o fator do snapshot do pedido. Quando a unidade não vem na nota,
 * NUNCA adivinhamos: o item é marcado para conferência manual.
 */

/** Unidades que representam embalagem fechada (múltiplas unidades). */
export const UNIDADES_EMBALAGEM = ["CX", "FD", "DZ", "PCT", "DP"] as const;

/** Unidades que representam unidade avulsa. */
export const UNIDADES_UNITARIAS = ["UN", "UNI", "UND", "UNID", "PC", "PÇ"] as const;

export type ClasseUnidade = "embalagem" | "unitaria" | "indefinida";

const clean = (raw: string | null | undefined) =>
  String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[.\s]/g, "");

export function classificarUnidade(unidade: string | null | undefined): ClasseUnidade {
  const key = clean(unidade);
  if (!key) return "indefinida";
  if ((UNIDADES_EMBALAGEM as readonly string[]).includes(key)) return "embalagem";
  if ((UNIDADES_UNITARIAS as readonly string[]).includes(key)) return "unitaria";
  return "indefinida";
}

export interface LinhaNf {
  unidade?: string | null;
  quantidade?: number | null;
  preco_unitario?: number | null;
}

export interface LinhaNfNormalizada {
  /** Quantidade em unidades (convertida quando aplicável). */
  quantidade: number | null;
  /** Preço por unidade (convertido quando aplicável). */
  preco_unitario: number | null;
  /** Houve conversão de embalagem → unidade. */
  convertido: boolean;
  /** Unidade não informada na nota: exige conferência manual. */
  unidadeIndefinida: boolean;
  /** Unidade como aparece na nota (normalizada em maiúsculas). */
  unidade: string | null;
  /** Valores originais da nota, para exibição. */
  quantidadeOriginal: number | null;
  precoOriginal: number | null;
}

/**
 * Normaliza uma linha da NF para "por unidade".
 * O `fator` deve vir do snapshot do pedido (cotacao_produtos.fator_embalagem).
 */
export function normalizarLinhaNf(linha: LinhaNf, fator: number): LinhaNfNormalizada {
  const qtd = linha.quantidade ?? null;
  const preco = linha.preco_unitario ?? null;
  const unidade = clean(linha.unidade) || null;
  const classe = classificarUnidade(linha.unidade);
  const fatorValido = fator && fator > 1 ? fator : 1;

  const base: LinhaNfNormalizada = {
    quantidade: qtd,
    preco_unitario: preco,
    convertido: false,
    unidadeIndefinida: false,
    unidade,
    quantidadeOriginal: qtd,
    precoOriginal: preco,
  };

  if (classe === "indefinida") {
    return { ...base, unidadeIndefinida: true };
  }

  if (classe === "embalagem" && fatorValido > 1) {
    return {
      ...base,
      quantidade: qtd != null ? qtd * fatorValido : null,
      preco_unitario: preco != null ? preco / fatorValido : null,
      convertido: true,
    };
  }

  return base;
}

/** Rótulo do preço convertido, ex: "R$ 9,29/un — NF: CX R$ 46,45". */
export function descreverConversao(n: LinhaNfNormalizada): string | null {
  if (!n.convertido || n.preco_unitario == null || n.precoOriginal == null) return null;
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${fmt(n.preco_unitario)}/un — NF: ${n.unidade} ${fmt(n.precoOriginal)}`;
}
