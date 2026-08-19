/**
 * Pure helpers for the Histórico de Cotações analytics tab.
 * Inputs come from the same shape used by HistoricoPage.tsx.
 */

export interface InsightCotacao {
  id: string;
  nome: string;
  created_at: string;
  status: string;
  loja_nome?: string | null;
  produtos_count: number;
  fornecedores_count: number;
  total_pedido: number;
}

/** A single (cotacao_produto × winner price) row used by analytics */
export interface InsightRow {
  cotacaoId: string;
  cotacaoNome: string;
  date: string;
  produtoNome: string;
  embalagem: string;
  fator: number;
  qtd: number;
  fornecedor: string;
  /** Unit price of the winner */
  precoUnit: number;
  /** Total = qtd × fator × precoUnit */
  total: number;
}

export interface KPIs {
  cotacoes: number;
  produtosUnicos: number;
  fornecedoresUnicos: number;
  totalGeral: number;
  ticketMedio: number;
  /** Aggregated savings vs the *worst* price received per item, summed. */
  economiaEstimada: number;
}

export interface FornecedorRanking {
  nome: string;
  vitorias: number;
  totalCotacoes: number;
  totalGanho: number;
  /** wins / totalCotacoes * 100 */
  taxa: number;
}

export interface ProdutoVariacao {
  produto: string;
  embalagem: string;
  amostras: number;
  precoMin: number;
  precoMax: number;
  precoMedio: number;
  /** (max - min) / min * 100 — null when min === 0 */
  variacaoPct: number | null;
  ultimoPreco: number;
  ultimoFornecedor: string;
  ultimoDate: string;
}

/**
 * Compute KPIs from a list of "winner" rows (one per produto × cotação).
 * `economiaEstimada` is computed elsewhere (needs all prices); pass 0 if N/A.
 */
export function computeKPIs(
  cotacoes: InsightCotacao[],
  rows: InsightRow[],
  economiaEstimada = 0
): KPIs {
  const produtosUnicos = new Set(rows.map((r) => r.produtoNome.toLowerCase().trim())).size;
  const fornecedoresUnicos = new Set(rows.map((r) => r.fornecedor)).size;
  const totalGeral = rows.reduce((a, r) => a + (r.total || 0), 0);
  const ticketMedio = cotacoes.length > 0 ? totalGeral / cotacoes.length : 0;
  return {
    cotacoes: cotacoes.length,
    produtosUnicos,
    fornecedoresUnicos,
    totalGeral,
    ticketMedio,
    economiaEstimada,
  };
}

/**
 * Ranking of suppliers by number of wins (cheapest price chosen) and total awarded.
 */
export function buildFornecedorRanking(rows: InsightRow[]): FornecedorRanking[] {
  // Track wins (rows where this supplier is the winner — every row in InsightRow is a win)
  // Track totalCotacoes participation by counting unique cotacaoIds the supplier appeared on.
  const winsByForn = new Map<string, { wins: number; total: number; cotacoes: Set<string> }>();
  for (const r of rows) {
    if (!r.fornecedor || r.fornecedor === "—") continue;
    if (!winsByForn.has(r.fornecedor)) {
      winsByForn.set(r.fornecedor, { wins: 0, total: 0, cotacoes: new Set() });
    }
    const e = winsByForn.get(r.fornecedor)!;
    e.wins += 1;
    e.total += r.total || 0;
    e.cotacoes.add(r.cotacaoId);
  }
  return Array.from(winsByForn.entries())
    .map(([nome, e]) => ({
      nome,
      vitorias: e.wins,
      totalCotacoes: e.cotacoes.size,
      totalGanho: e.total,
      taxa: e.cotacoes.size > 0 ? (e.wins / e.cotacoes.size) * 100 : 0,
    }))
    .sort((a, b) => b.totalGanho - a.totalGanho);
}

/**
 * Per-product variation across cotações: min/max/avg of the winning unit price,
 * % spread, and most recent price.
 */
export function buildProdutoVariacao(rows: InsightRow[]): ProdutoVariacao[] {
  const byProd = new Map<string, InsightRow[]>();
  for (const r of rows) {
    const key = r.produtoNome.toLowerCase().trim();
    if (!byProd.has(key)) byProd.set(key, []);
    byProd.get(key)!.push(r);
  }
  const out: ProdutoVariacao[] = [];
  for (const list of byProd.values()) {
    if (list.length === 0) continue;
    const precos = list.map((r) => r.precoUnit).filter((n) => n > 0);
    if (precos.length === 0) continue;
    const min = Math.min(...precos);
    const max = Math.max(...precos);
    const avg = precos.reduce((a, n) => a + n, 0) / precos.length;
    const sortedByDate = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const ultimo = sortedByDate[0];
    out.push({
      produto: list[0].produtoNome,
      embalagem: list[0].embalagem,
      amostras: precos.length,
      precoMin: min,
      precoMax: max,
      precoMedio: avg,
      variacaoPct: min > 0 ? ((max - min) / min) * 100 : null,
      ultimoPreco: ultimo.precoUnit,
      ultimoFornecedor: ultimo.fornecedor,
      ultimoDate: ultimo.date,
    });
  }
  // Highest variation first → user sees the most volatile items at the top.
  return out.sort((a, b) => (b.variacaoPct ?? -1) - (a.variacaoPct ?? -1));
}

/**
 * Estimate aggregate savings vs paying the AVERAGE price received for each item
 * (i.e. what you'd pay buying without comparing). More defensible than the worst price.
 * `pricesPerRow` maps an InsightRow to all valid unit prices received for that line.
 */
export function computeEconomia(
  rows: InsightRow[],
  pricesPerRow: (r: InsightRow) => number[]
): number {
  let economia = 0;
  for (const r of rows) {
    const all = pricesPerRow(r);
    if (all.length < 2) continue;
    const media = all.reduce((a, n) => a + n, 0) / all.length;
    const diff = media - r.precoUnit;
    if (diff > 0) economia += diff * r.qtd * r.fator;
  }
  return economia;
}
