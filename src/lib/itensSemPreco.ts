/**
 * Itens que não receberam preço de NENHUM fornecedor.
 *
 * Fonte única de verdade para:
 * - contar / listar os itens sem preço de uma cotação;
 * - carregá-los para a próxima cotação preservando o snapshot completo
 *   (nome, EAN, catálogo, produto local, embalagem e fator).
 *
 * Critério: nenhuma linha em `precos` com `preco > 0` para o item.
 */

export interface CotacaoProdutoLike {
  id: string;
  produto_id?: string | null;
  catalogo_mestre_id?: string | null;
  nome?: string | null;
  ean?: string | null;
  quantidade?: number | null;
  tipo_embalagem?: string | null;
  fator_embalagem?: number | null;
}

export interface PrecoLike {
  cotacao_produto_id: string;
  preco?: number | string | null;
}

/** Ids de itens que possuem pelo menos um preço > 0. */
export const idsComPreco = (precos: PrecoLike[]): Set<string> => {
  const set = new Set<string>();
  for (const p of precos || []) {
    const v = Number(p?.preco);
    if (Number.isFinite(v) && v > 0) set.add(p.cotacao_produto_id);
  }
  return set;
};

/** Filtra os itens da cotação que ficaram sem nenhum preço. */
export const filtrarItensSemPreco = <T extends CotacaoProdutoLike>(
  cotacaoProdutos: T[],
  precos: PrecoLike[],
): T[] => {
  const comPreco = idsComPreco(precos);
  return (cotacaoProdutos || []).filter((cp) => !comPreco.has(cp.id));
};

export interface CotacaoProdutoCarryInsert {
  cotacao_id: string;
  produto_id: string | null;
  catalogo_mestre_id: string | null;
  nome: string;
  ean: string | null;
  quantidade: number;
  tipo_embalagem: string | null;
  fator_embalagem: number;
}

/** Monta o payload de insert dos itens sem preço na nova cotação. */
export const buildCarryInserts = (
  cotacaoId: string,
  itens: CotacaoProdutoLike[],
): CotacaoProdutoCarryInsert[] =>
  (itens || []).map((cp) => ({
    cotacao_id: cotacaoId,
    produto_id: cp.produto_id ?? null,
    catalogo_mestre_id: cp.catalogo_mestre_id ?? null,
    nome: cp.nome ?? "",
    ean: cp.ean ?? null,
    quantidade: Math.max(1, Number(cp.quantidade) || 1),
    tipo_embalagem: cp.tipo_embalagem ?? null,
    fator_embalagem:
      cp.fator_embalagem && cp.fator_embalagem > 0 ? cp.fator_embalagem : 1,
  }));

/** Chave localStorage do banner "itens carregados por falta de preço". */
export const carryBannerKey = (cotacaoId: string) => `sem-preco-carregados-${cotacaoId}`;

export const registrarCarry = (cotacaoId: string, total: number) => {
  if (total <= 0) return;
  try {
    localStorage.setItem(carryBannerKey(cotacaoId), String(total));
  } catch { /* ignore */ }
};

export const lerCarry = (cotacaoId: string): number => {
  try {
    return Number(localStorage.getItem(carryBannerKey(cotacaoId))) || 0;
  } catch {
    return 0;
  }
};

export const limparCarry = (cotacaoId: string) => {
  try {
    localStorage.removeItem(carryBannerKey(cotacaoId));
  } catch { /* ignore */ }
};
