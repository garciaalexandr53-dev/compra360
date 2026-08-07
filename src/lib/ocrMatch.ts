/**
 * Pareamento (matching) entre a descrição do produto na nota fiscal e o nome
 * do item do pedido.
 *
 * Notas fiscais usam abreviações ("BEB.LACTEA LIDER 1LT AVEIA") enquanto o
 * pedido usa o nome do catálogo ("Aveia Bebida Lactea Uht Com Aveia 1L").
 * Comparação por substring/uma palavra gera falso positivo e deixa itens
 * corretos como "faltando". Aqui normalizamos, expandimos abreviações e
 * escolhemos o MELHOR candidato por sobreposição de tokens.
 */

const ABREV: Record<string, string> = {
  beb: "bebida",
  lact: "lactea",
  lacte: "lactea",
  aguard: "aguardente",
  desod: "desodorante",
  achoc: "achocolatado",
  choc: "chocolate",
  ref: "refrigerante",
  det: "detergente",
  sab: "sabao",
  amac: "amaciante",
  past: "pasta",
  cr: "creme",
  grs: "g",
  gr: "g",
  grms: "g",
  gramas: "g",
  lt: "l",
  lts: "l",
  ltr: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
  kg: "kg",
  un: "",
  uni: "",
  und: "",
  unidade: "",
  cx: "",
  fd: "",
  pct: "",
  pc: "",
  c: "",
  com: "",
  de: "",
  da: "",
  do: "",
  e: "",
  tp: "",
};

/** Remove acentos, pontuação e normaliza para minúsculas. */
export function normalizarTexto(raw: string): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tokens normalizados e expandidos, sem palavras vazias. */
export function tokenizar(raw: string): string[] {
  const out: string[] = [];
  for (const part of normalizarTexto(raw).split(" ")) {
    if (!part) continue;
    // separa número de letra: "1lt" -> "1", "lt"; "350g" -> "350", "g"
    const pieces = part.match(/\d+|[a-z]+/g) || [part];
    for (const p of pieces) {
      const mapped = p in ABREV ? ABREV[p] : p;
      if (mapped && mapped.length > 0) out.push(mapped);
    }
  }
  return Array.from(new Set(out));
}

/** Similaridade 0..1 entre duas descrições (Dice sobre tokens). */
export function similaridade(a: string, b: string): number {
  const ta = tokenizar(a);
  const tb = tokenizar(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const inter = ta.filter((t) => setB.has(t));
  if (!inter.length) return 0;
  const temPalavra = inter.some((t) => t.length > 2 && !/^\d+$/.test(t));
  if (!temPalavra) return 0;
  return (2 * inter.length) / (ta.length + tb.length);
}

export const LIMIAR_MATCH = 0.34;

/**
 * Encontra o índice do melhor candidato em `nomes` para a descrição da nota.
 * Retorna -1 quando nenhum candidato atinge o limiar.
 * `indisponiveis` marca índices já usados por outra linha da nota.
 */
export function encontrarMelhorMatch(
  descricaoNf: string,
  nomes: string[],
  indisponiveis: Set<number> = new Set(),
  limiar: number = LIMIAR_MATCH,
): number {
  let bestIdx = -1;
  let bestScore = 0;
  nomes.forEach((nome, i) => {
    if (indisponiveis.has(i)) return;
    const score = similaridade(descricaoNf, nome);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return bestScore >= limiar ? bestIdx : -1;
}
