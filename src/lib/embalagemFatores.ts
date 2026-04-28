/**
 * Lista canônica de embalagens disponíveis no diálogo de adicionar produto
 * e seus fatores padrão (unidades por embalagem).
 *
 * Fonte única — usado por ProdutosPage e AppFuncionariosPublic.
 */
import { getDefaultFator as _getDefaultFator } from "./embalagem";

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

/** Fator padrão sugerido ao trocar para uma embalagem. */
export const getFatorPadrao = (sigla: string): number => _getDefaultFator(sigla);

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
