/**
 * Embalagem (packaging) types and conversion factors.
 * The factor represents how many base units are in one package.
 */

export const EMBALAGEM_OPTIONS = [
  { sigla: "UNI", nome: "Unidade", fatorPadrao: 1 },
  { sigla: "CX",  nome: "Caixa",   fatorPadrao: 12 },
  { sigla: "DZ",  nome: "Dúzia",   fatorPadrao: 12 },
  { sigla: "½DZ", nome: "Meia Dúzia", fatorPadrao: 6 },
  { sigla: "FD",  nome: "Fardo",   fatorPadrao: 6 },
  { sigla: "PCT", nome: "Pacote",  fatorPadrao: 1 },
  { sigla: "KG",  nome: "Quilo",   fatorPadrao: 1 },
  { sigla: "LT",  nome: "Litro",   fatorPadrao: 1 },
  { sigla: "SC",  nome: "Saco",    fatorPadrao: 1 },
  { sigla: "GL",  nome: "Galão",   fatorPadrao: 1 },
] as const;

export const EMBALAGEM_SIGLAS = EMBALAGEM_OPTIONS.map(e => e.sigla);

/** Get default factor for a given embalagem sigla */
export function getDefaultFator(sigla: string): number {
  const found = EMBALAGEM_OPTIONS.find(e => e.sigla === sigla);
  return found?.fatorPadrao ?? 1;
}

/** Format embalagem + fator for display, e.g. "2 CX (24un)" */
export function formatEmbalagemQtd(quantidade: number, embalagem: string, fator: number): string {
  if (fator <= 1) return `${quantidade} ${embalagem}`;
  return `${quantidade} ${embalagem} (${quantidade * fator}un)`;
}
