import { supabase } from "@/integrations/supabase/client";
import { fetchPrecosByCpIds } from "@/lib/supabaseHelpers";
import { getCotacaoNome, getCotacaoEmbalagem, getCotacaoFator } from "@/lib/buscaProdutos";
import {
  exportCotacaoToPdf,
  type ExportCotacaoMeta,
  type ExportRow,
  type ExportPedidoForn,
} from "@/lib/historicoExports";

export interface CotacaoExportData {
  meta: ExportCotacaoMeta;
  rows: ExportRow[];
  pedidos: ExportPedidoForn[];
}

/** Monta as linhas do pedido (vencedor por produto) a partir de produtos + preços. */
export function buildRowsFromDetails(produtos: any[], precos: any[]): ExportRow[] {
  return produtos.map((cp: any) => {
    const cpPrecos = precos.filter(
      (p: any) => p.cotacao_produto_id === cp.id && p.preco != null && Number(p.preco) > 0
    );
    const sorted = [...cpPrecos].sort((a, b) => Number(a.preco) - Number(b.preco));
    const winner = sorted[0] || null;
    const qtd = Number(cp.quantidade || 1);
    const fator = getCotacaoFator(cp);
    const precoUnit = winner ? Number(winner.preco) : null;
    return {
      nome: getCotacaoNome(cp),
      embalagem: getCotacaoEmbalagem(cp),
      fator,
      qtd,
      fornecedor: winner?.fornecedores?.nome || "—",
      precoUnit,
      total: precoUnit != null ? precoUnit * qtd * fator : null,
      allPrecos: sorted,
    } as ExportRow;
  });
}

/** Agrupa as linhas por fornecedor vencedor. */
export function buildPedidosFromRows(rows: ExportRow[]): ExportPedidoForn[] {
  const byForn = new Map<string, ExportPedidoForn>();
  for (const r of rows) {
    if (!r.fornecedor || r.fornecedor === "—") continue;
    if (!byForn.has(r.fornecedor)) byForn.set(r.fornecedor, { fornecedor: r.fornecedor, itens: [], total: 0 });
    const g = byForn.get(r.fornecedor)!;
    g.itens.push(r);
    g.total += r.total || 0;
  }
  return Array.from(byForn.values()).sort((a, b) => b.total - a.total);
}

/** Busca no banco tudo o que o PDF precisa a partir do id da cotação. */
export async function fetchCotacaoExportData(cotacaoId: string): Promise<CotacaoExportData | null> {
  const { data: cot } = await supabase
    .from("cotacoes")
    .select("id, nome, created_at, finalizada_at, status, lojas(nome)")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (!cot) return null;

  const { data: produtos } = await supabase
    .from("cotacao_produtos")
    .select("id, nome, quantidade, tipo_embalagem, fator_embalagem, catalogo_mestre_id, produtos(nome, embalagem, fator_embalagem)")
    .eq("cotacao_id", cotacaoId);

  const cps = produtos || [];
  const precos = cps.length
    ? await fetchPrecosByCpIds<any>(cps.map((cp: any) => cp.id), "cotacao_produto_id, preco, fornecedores(nome)")
    : [];

  const rows = buildRowsFromDetails(cps as any[], precos as any[]);
  const pedidos = buildPedidosFromRows(rows);
  const total = rows.reduce((a, r) => a + (r.total || 0), 0);

  const lojaRel: any = (cot as any).lojas;
  const lojaNome = Array.isArray(lojaRel) ? lojaRel[0]?.nome : lojaRel?.nome;

  return {
    meta: {
      nome: (cot as any).nome || "Cotação",
      created_at: (cot as any).created_at,
      finalizada_at: (cot as any).finalizada_at,
      status: (cot as any).status,
      loja_nome: lojaNome ?? null,
      total_pedido: total,
      produtos_count: rows.length,
      fornecedores_count: pedidos.length,
    },
    rows,
    pedidos,
  };
}

/** Gera e baixa o PDF da cotação informada. */
export async function downloadCotacaoPdfById(cotacaoId: string) {
  const data = await fetchCotacaoExportData(cotacaoId);
  if (!data) throw new Error("Cotação não encontrada");
  await exportCotacaoToPdf(data.meta, data.rows, data.pedidos);
}
