/**
 * Regras de validação e detecção de duplicatas do Catálogo Mestre (área admin).
 */

/** Embalagens permitidas no catálogo mestre. */
export const CATALOGO_EMBALAGENS = ["UNI", "CX", "DZ", "DP", "FD", "KG", "PCT", "LT"] as const;
export type CatalogoEmbalagem = (typeof CATALOGO_EMBALAGENS)[number];

/** Embalagens fechadas: espera-se fator > 1. */
export const EMBALAGENS_FECHADAS = ["CX", "DZ", "DP", "FD"];

const EAN_LENGTHS = [8, 12, 13, 14];

export type CatalogoForm = {
  nome: string;
  ean: string;
  embalagem: string;
  fator_embalagem: number;
  ativo: boolean;
};

export type ValidacaoCatalogo = {
  /** Erros que bloqueiam o salvamento. */
  erros: string[];
  /** Avisos informativos (não bloqueiam). */
  avisos: string[];
  ok: boolean;
};

/** Mantém apenas dígitos. */
export const soDigitos = (v: string): string => (v || "").replace(/\D/g, "");

export function validarCatalogoForm(form: CatalogoForm): ValidacaoCatalogo {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!form.nome?.trim()) erros.push("Informe o nome do produto.");

  const ean = soDigitos(form.ean);
  if (ean && !EAN_LENGTHS.includes(ean.length)) {
    erros.push("EAN deve ter 8, 12, 13 ou 14 dígitos.");
  }

  const fator = Number(form.fator_embalagem);
  if (!Number.isInteger(fator) || fator < 1) {
    erros.push("Fator de embalagem deve ser um número inteiro maior ou igual a 1.");
  }

  const emb = (form.embalagem || "").trim().toUpperCase();
  if (!CATALOGO_EMBALAGENS.includes(emb as CatalogoEmbalagem)) {
    erros.push("Selecione uma embalagem válida.");
  } else if (EMBALAGENS_FECHADAS.includes(emb) && fator === 1) {
    avisos.push(`Embalagem ${emb} normalmente tem fator maior que 1. Confirme se está correto.`);
  }

  return { erros, avisos, ok: erros.length === 0 };
}

/** Normaliza nome para comparação: sem acentos, minúsculo, espaços colapsados. */
export function normalizarNome(nome: string): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras significativas (≥3 letras) para busca de nomes semelhantes. */
export function palavrasChave(nome: string): string[] {
  return normalizarNome(nome)
    .split(" ")
    .filter((p) => p.length >= 3)
    .slice(0, 3);
}

/** Similaridade simples por sobreposição de palavras (0 a 1). */
export function similaridadeNome(a: string, b: string): number {
  const setA = new Set(normalizarNome(a).split(" ").filter(Boolean));
  const setB = new Set(normalizarNome(b).split(" ").filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  setA.forEach((w) => { if (setB.has(w)) inter += 1; });
  return inter / Math.max(setA.size, setB.size);
}
