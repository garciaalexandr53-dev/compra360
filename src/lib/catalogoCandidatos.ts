/**
 * Normalização dos candidatos ao Catálogo Mestre (área admin).
 * Fonte: RPC `admin_list_candidatos_catalogo`.
 */

import { getFatorPadrao, matchEmbalagem } from "@/lib/embalagemFatores";
import { CATALOGO_EMBALAGENS } from "@/lib/catalogoAdmin";

export type CandidatoRow = {
  ean: string;
  nome: string | null;
  embalagem: string | null;
  fator_embalagem: number | null;
  origens: string[] | null;
  ocorrencias: number | null;
  ultimo_em: string | null;
};

export type Candidato = {
  ean: string;
  nome: string;
  embalagem: string;
  fator_embalagem: number;
  /** Rótulos legíveis das origens. */
  origens: string[];
  ocorrencias: number;
  ultimo_em: string | null;
};

const ORIGEM_LABEL: Record<string, string> = {
  itens_faltantes: "App Funcionários",
  produtos: "Catálogo local",
};

export const rotuloOrigem = (origem: string): string => ORIGEM_LABEL[origem] ?? origem;

/** Embalagem válida para o catálogo mestre (fallback UNI). */
const embalagemCatalogo = (valor: string | null): string => {
  const canonica = matchEmbalagem(valor);
  return (CATALOGO_EMBALAGENS as readonly string[]).includes(canonica) ? canonica : "UNI";
};

export function mapCandidato(row: CandidatoRow): Candidato {
  const embalagem = embalagemCatalogo(row.embalagem);
  const fator =
    row.fator_embalagem && row.fator_embalagem > 0 ? Math.trunc(row.fator_embalagem) : getFatorPadrao(embalagem);
  const origens = Array.from(new Set(row.origens || [])).map(rotuloOrigem);
  return {
    ean: row.ean,
    nome: (row.nome || "").trim(),
    embalagem,
    fator_embalagem: fator > 0 ? fator : 1,
    origens,
    ocorrencias: row.ocorrencias && row.ocorrencias > 0 ? row.ocorrencias : 1,
    ultimo_em: row.ultimo_em,
  };
}

/** Dedupe defensivo por EAN (a RPC já agrupa). */
export function mapCandidatos(rows: CandidatoRow[]): Candidato[] {
  const seen = new Set<string>();
  const out: Candidato[] = [];
  for (const row of rows || []) {
    if (!row?.ean || seen.has(row.ean)) continue;
    seen.add(row.ean);
    out.push(mapCandidato(row));
  }
  return out;
}

/** Filtro local por nome ou EAN. */
export function filtrarCandidatos(itens: Candidato[], termo: string): Candidato[] {
  const t = (termo || "").trim().toLowerCase();
  if (!t) return itens;
  return itens.filter((c) => c.ean.includes(t) || c.nome.toLowerCase().includes(t));
}
