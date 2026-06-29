/**
 * Fonte ÚNICA de verdade para busca híbrida de produtos
 * (catalogo_mestre global + produtos locais do cliente) e para
 * a montagem do snapshot gravado em cotacao_produtos.
 *
 * NÃO duplicar essas regras em componentes / páginas.
 * Sempre importar via:
 *   import { ... } from "@/lib/buscaProdutos";
 */

import { getFatorPadrao, matchEmbalagem } from "@/lib/embalagemFatores";

export type FonteProduto = "catalogo" | "local";

/** Linha retornada pelas RPCs `search_produtos_hibrido` e `search_produtos_funcionario`. */
export interface ProdutoHibrido {
  fonte: FonteProduto;
  id: string;
  nome: string;
  ean: string | null;
  embalagem: string | null;
  fator_embalagem: number | null;
}

export const isCatalogo = (p: Pick<ProdutoHibrido, "fonte">): boolean =>
  p.fonte === "catalogo";

/** Embalagem/fator do catálogo são travados — nem cliente nem funcionário editam. */
export const isProdutoLocked = (p: Pick<ProdutoHibrido, "fonte">): boolean =>
  isCatalogo(p);

/**
 * Dedup defensivo no frontend (a fonte única de verdade é a RPC no banco).
 * Mantemos por segurança caso outra fonte agregue resultados.
 * Catálogo SEMPRE prevalece sobre produto local com mesmo nome.
 */
export const dedupHibridos = (rows: ProdutoHibrido[]): ProdutoHibrido[] => {
  const seen = new Set<string>();
  const result: ProdutoHibrido[] = [];
  for (const r of rows) {
    if (r.fonte !== "catalogo") continue;
    const k = r.nome.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(r);
  }
  for (const r of rows) {
    if (r.fonte !== "local") continue;
    const k = r.nome.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(r);
  }
  return result;
};

/** Payload de insert em cotacao_produtos (snapshot obrigatório). */
export interface CotacaoProdutoSnapshotInsert {
  cotacao_id: string;
  produto_id: string | null;
  catalogo_mestre_id: string | null;
  nome: string;
  ean: string | null;
  tipo_embalagem: string;
  fator_embalagem: number;
  quantidade: number;
}

interface BuildSnapshotArgs {
  cotacaoId: string;
  produto: ProdutoHibrido;
  quantidade: number;
  /** Overrides do usuário — IGNORADOS quando o produto é do catálogo (travado). */
  embalagem?: string | null;
  fator?: number | null;
}

/**
 * Monta o payload de cotacao_produtos a partir do produto híbrido.
 *
 * Regras (Pilar 3):
 * - Catálogo: catalogo_mestre_id setado, produto_id NULL, nome/ean/embalagem/fator
 *   COPIADOS do catálogo (ignora overrides — campos travados).
 * - Local: produto_id setado, catalogo_mestre_id NULL, ean NULL,
 *   nome copiado e embalagem/fator respeitam o que o usuário ajustou no diálogo,
 *   com fallback para o cadastro do produto.
 */
export const buildSnapshotInsert = ({
  cotacaoId,
  produto,
  quantidade,
  embalagem,
  fator,
}: BuildSnapshotArgs): CotacaoProdutoSnapshotInsert => {
  if (isCatalogo(produto)) {
    const embCanonica = matchEmbalagem(produto.embalagem);
    const fatorCatalogo =
      produto.fator_embalagem && produto.fator_embalagem > 0
        ? produto.fator_embalagem
        : getFatorPadrao(embCanonica);
    return {
      cotacao_id: cotacaoId,
      produto_id: null,
      catalogo_mestre_id: produto.id,
      nome: produto.nome,
      ean: produto.ean ?? null,
      tipo_embalagem: embCanonica,
      fator_embalagem: fatorCatalogo,
      quantidade,
    };
  }

  const embFinal = matchEmbalagem(embalagem ?? produto.embalagem);
  const fatorFinal =
    (fator && fator > 0
      ? fator
      : produto.fator_embalagem && produto.fator_embalagem > 0
      ? produto.fator_embalagem
      : getFatorPadrao(embFinal));

  return {
    cotacao_id: cotacaoId,
    produto_id: produto.id,
    catalogo_mestre_id: null,
    nome: produto.nome,
    ean: null,
    tipo_embalagem: embFinal,
    fator_embalagem: fatorFinal,
    quantidade,
  };
};

/* ---------- helpers de leitura: SEMPRE preferir snapshot ---------- */

interface CotacaoProdutoDisplay {
  nome?: string | null;
  tipo_embalagem?: string | null;
  fator_embalagem?: number | null;
  catalogo_mestre_id?: string | null;
  produtos?: { nome?: string | null; embalagem?: string | null; fator_embalagem?: number | null } | null;
  produto?: { nome?: string | null; embalagem?: string | null; fator_embalagem?: number | null } | null;
}

/** Nome a exibir: SEMPRE preferir o snapshot (cotacao_produtos.nome). */
export const getCotacaoNome = (cp: CotacaoProdutoDisplay): string =>
  cp.nome?.trim() ||
  cp.produtos?.nome ||
  cp.produto?.nome ||
  "—";

/** Embalagem a exibir: snapshot tem prioridade. */
export const getCotacaoEmbalagem = (cp: CotacaoProdutoDisplay): string =>
  (cp.tipo_embalagem && cp.tipo_embalagem.trim()) ||
  cp.produtos?.embalagem ||
  cp.produto?.embalagem ||
  "un";

/** Fator a exibir: snapshot tem prioridade. */
export const getCotacaoFator = (cp: CotacaoProdutoDisplay): number => {
  const snap = cp.fator_embalagem;
  if (snap && snap > 0) return snap;
  const cad = cp.produtos?.fator_embalagem ?? cp.produto?.fator_embalagem;
  return cad && cad > 0 ? cad : 1;
};

/** Item da cotação vem do catálogo global? */
export const isCotacaoCatalogo = (cp: { catalogo_mestre_id?: string | null }): boolean =>
  !!cp.catalogo_mestre_id;
