/**
 * Fonte ÚNICA de fatores padrão por embalagem.
 *
 * Nenhum outro arquivo do projeto pode ter números de fator hardcoded.
 * Sempre importar daqui:
 *   import { FATOR_PADRAO, getFatorPadrao } from "@/lib/embalagemFatores";
 *   const fator = FATOR_PADRAO[embalagem] ?? 1;
 */

/** Mapa canônico embalagem → fator padrão (unidades por embalagem). */
export const FATOR_PADRAO: Record<string, number> = {
  UNI: 1,
  CX: 12,
  DZ: 12,
  "½DZ": 6,
  DP: 12,
  FD: 6,
  PCT: 1,
  KG: 1,
  LT: 1,
  SC: 1,
  GL: 1,
};

/** Lista de embalagens exibidas no diálogo de adicionar produto (ordem importa). */
export const EMBALAGENS_DIALOG = [
  "UNI",
  "CX",
  "DZ",
  "½DZ",
  "DP",
  "FD",
  "KG",
  "PCT",
  "LT",
] as const;

export type EmbalagemSigla = (typeof EMBALAGENS_DIALOG)[number];

/** Fator padrão sugerido ao trocar para uma embalagem.
 * Normaliza case e espaços para tolerar entradas como "cx" ou " CX ". */
export const getFatorPadrao = (sigla: string | null | undefined): number => {
  if (sigla == null) return 1;
  const key = String(sigla).trim().toUpperCase();
  if (!key) return 1;
  return FATOR_PADRAO[key] ?? 1;
};

/** Normaliza uma string de embalagem cadastrada para uma sigla suportada no diálogo. */
export const matchEmbalagem = (raw: string | null | undefined): EmbalagemSigla => {
  const cleaned = (raw || "UNI").split("|")[0]?.trim().toUpperCase() || "UNI";
  const found = EMBALAGENS_DIALOG.find((sigla) =>
    cleaned.startsWith(sigla.toUpperCase()),
  );
  return (found ?? "UNI") as EmbalagemSigla;
};

/** Resolve o fator inicial: usa o cadastrado se válido, senão o padrão da embalagem. */
export const resolveFatorInicial = (
  sigla: string,
  fatorCadastrado: number | null | undefined,
): number => {
  if (fatorCadastrado && fatorCadastrado > 0) return fatorCadastrado;
  return getFatorPadrao(sigla);
};
