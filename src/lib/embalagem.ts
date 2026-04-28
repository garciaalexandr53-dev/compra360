/**
 * Embalagem (packaging) types.
 *
 * IMPORTANTE: Os fatores padrão vêm de src/lib/embalagemFatores.ts (fonte única).
 * Não duplicar números aqui.
 */
import { FATOR_PADRAO, getFatorPadrao } from "./embalagemFatores";

const EMBALAGEM_NOMES: Record<string, string> = {
  UNI: "Unidade",
  CX: "Caixa",
  DZ: "Dúzia",
  "½DZ": "Meia Dúzia",
  DP: "Display",
  FD: "Fardo",
  PCT: "Pacote",
  KG: "Quilo",
  LT: "Litro",
  SC: "Saco",
  GL: "Galão",
};

export const EMBALAGEM_OPTIONS = Object.keys(FATOR_PADRAO).map((sigla) => ({
  sigla,
  nome: EMBALAGEM_NOMES[sigla] ?? sigla,
  fatorPadrao: FATOR_PADRAO[sigla],
}));

export const EMBALAGEM_SIGLAS = EMBALAGEM_OPTIONS.map((e) => e.sigla);

/** @deprecated Use getFatorPadrao de "@/lib/embalagemFatores". */
export function getDefaultFator(sigla: string): number {
  return getFatorPadrao(sigla);
}

/** Format embalagem + fator for display, e.g. "2 CX (24un)" */
export function formatEmbalagemQtd(quantidade: number, embalagem: string, fator: number): string {
  if (fator <= 1) return `${quantidade} ${embalagem}`;
  return `${quantidade} ${embalagem} (${quantidade * fator}un)`;
}
