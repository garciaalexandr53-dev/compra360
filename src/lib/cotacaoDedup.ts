/**
 * Segunda trava anti-duplicidade em cotações.
 *
 * A trava original compara apenas os identificadores técnicos
 * (`produto_id` para itens locais e `catalogo_mestre_id` para itens do
 * Catálogo Mestre). Ela continua valendo — porém não detecta o caso em que o
 * MESMO produto entra duas vezes por fontes diferentes (uma linha local e uma
 * linha do catálogo), como aconteceu com "Sal Grosso para Churrasco Uniao 1kg".
 *
 * Esta trava complementar compara o NOME normalizado (sem acentos, sem
 * pontuação, minúsculo, espaços colapsados) de tudo que já está na cotação.
 */

export type CotacaoDedupRow = {
  nome?: string | null;
  produto_id?: string | null;
  catalogo_mestre_id?: string | null;
  ean?: string | null;
};

/** Nome normalizado usado como chave de comparação entre fontes diferentes. */
export const normalizeNomeCotacao = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Conjunto de nomes normalizados já presentes na cotação. */
export const buildNomeIndex = (rows: CotacaoDedupRow[]): Set<string> => {
  const set = new Set<string>();
  for (const r of rows) {
    const k = normalizeNomeCotacao(r.nome);
    if (k) set.add(k);
  }
  return set;
};

/**
 * Trava 1 (IDs) + Trava 2 (nome normalizado).
 * Retorna true quando o item NÃO deve ser inserido novamente.
 */
export const isDuplicadoNaCotacao = (
  rows: CotacaoDedupRow[],
  candidato: { nome?: string | null; produtoId?: string | null; catalogoMestreId?: string | null },
): boolean => {
  // Trava 1 — identificadores técnicos (comportamento já existente).
  if (candidato.produtoId && rows.some((r) => r.produto_id === candidato.produtoId)) return true;
  if (
    candidato.catalogoMestreId &&
    rows.some((r) => r.catalogo_mestre_id === candidato.catalogoMestreId)
  ) {
    return true;
  }
  // Trava 2 — nome normalizado, independente da origem do produto.
  const key = normalizeNomeCotacao(candidato.nome);
  if (!key) return false;
  return buildNomeIndex(rows).has(key);
};
