/**
 * Fonte ÚNICA de verdade para transformar uma linha de `itens_faltantes`
 * (registrada pelo app de funcionários) no payload de insert em
 * `cotacao_produtos`.
 *
 * Regras:
 * - Itens do CATÁLOGO global: identificados por `catalogo_mestre_id`.
 *   Snapshot é montado direto das COLUNAS estruturadas (nome / ean /
 *   embalagem / fator_embalagem). Nunca parsear `observacao`.
 * - Itens LOCAIS: precisam de um produto correspondente no banco do
 *   cliente. Embalagem/fator vêm primeiro das colunas estruturadas;
 *   só como compatibilidade com linhas antigas usamos os resolvers
 *   legacy que leem da observação.
 *
 * NÃO duplicar essas regras em páginas/componentes — sempre importar
 * via:  import { ... } from "@/lib/itensFaltantesImport";
 */

import {
  buildSnapshotInsert,
  type CotacaoProdutoSnapshotInsert,
} from "@/lib/buscaProdutos";

export interface ItemFaltanteRow {
  id: string;
  nome: string;
  quantidade: number | null;
  ean: string | null;
  catalogo_mestre_id: string | null;
  embalagem: string | null;
  fator_embalagem: number | null;
  /** Mantido apenas para compatibilidade com linhas antigas. */
  observacao: string | null;
}

export interface ProdutoLocalCadastro {
  id: string;
  nome: string;
  embalagem: string | null;
  fator_embalagem: number | null;
}

export interface BuildCpFromItemArgs {
  cotacaoId: string;
  item: ItemFaltanteRow;
  /** Produto local correspondente — obrigatório para itens locais. */
  produtoLocal?: ProdutoLocalCadastro | null;
  /** Fallback legacy: resolve embalagem a partir de observacao. */
  legacyResolveEmb?: (obs: string | null, cad: string | null) => string;
  /** Fallback legacy: resolve fator a partir de observacao. */
  legacyResolveFator?: (obs: string | null, cad: number | null) => number;
}

export const buildCotacaoProdutoInsertFromItem = ({
  cotacaoId,
  item,
  produtoLocal,
  legacyResolveEmb,
  legacyResolveFator,
}: BuildCpFromItemArgs): CotacaoProdutoSnapshotInsert | null => {
  const quantidade = item.quantidade ?? 1;

  // Catálogo: snapshot direto das colunas estruturadas
  if (item.catalogo_mestre_id) {
    return buildSnapshotInsert({
      cotacaoId,
      quantidade,
      produto: {
        fonte: "catalogo",
        id: item.catalogo_mestre_id,
        nome: item.nome,
        ean: item.ean,
        embalagem: item.embalagem,
        fator_embalagem: item.fator_embalagem,
      },
    });
  }

  // Local: precisa de produto correspondente
  if (!produtoLocal) return null;

  const embFromColumn = item.embalagem?.trim() ? item.embalagem : null;
  const fatorFromColumn =
    item.fator_embalagem && item.fator_embalagem > 0 ? item.fator_embalagem : null;

  const embFinal =
    embFromColumn ??
    (legacyResolveEmb
      ? legacyResolveEmb(item.observacao, produtoLocal.embalagem)
      : produtoLocal.embalagem);

  const fatorFinal =
    fatorFromColumn ??
    (legacyResolveFator
      ? legacyResolveFator(item.observacao, produtoLocal.fator_embalagem)
      : produtoLocal.fator_embalagem ?? 1);

  return buildSnapshotInsert({
    cotacaoId,
    quantidade,
    produto: {
      fonte: "local",
      id: produtoLocal.id,
      nome: produtoLocal.nome,
      ean: null,
      embalagem: embFinal,
      fator_embalagem: fatorFinal,
    },
  });
};

/** Embalagem/fator considerados padrão (catálogo mestre ou cadastro local). */
export interface PadraoEmbalagem {
  embalagem: string | null;
  fator_embalagem: number | null;
}

export interface SugestaoEquipe {
  divergente: boolean;
  sugerido: { embalagem: string; fator: number };
  padrao: { embalagem: string; fator: number };
}

const normEmb = (raw: string | null | undefined): string =>
  (raw || "UNI").split("|")[0]?.trim().toUpperCase() || "UNI";

const normFator = (f: number | null | undefined): number =>
  f && f > 0 ? f : 1;

/**
 * Compara o que o funcionário gravou em `itens_faltantes` com o padrão de
 * origem (catálogo mestre / cadastro local). Divergência = "Sugestão da equipe".
 * O ajuste NUNCA altera o catálogo — apenas o snapshot do item.
 */
export const detectarSugestaoEquipe = (
  item: Pick<ItemFaltanteRow, "embalagem" | "fator_embalagem">,
  padrao: PadraoEmbalagem | null | undefined,
): SugestaoEquipe | null => {
  if (!padrao) return null;
  const sugerido = {
    embalagem: normEmb(item.embalagem),
    fator: normFator(item.fator_embalagem),
  };
  const base = {
    embalagem: normEmb(padrao.embalagem),
    fator: normFator(padrao.fator_embalagem),
  };
  return {
    divergente: sugerido.embalagem !== base.embalagem || sugerido.fator !== base.fator,
    sugerido,
    padrao: base,
  };
};

/* -------------------------------------------------------------------------
 * Deduplicação na importação
 * ---------------------------------------------------------------------- */

/** Normaliza nome: sem acento, sem caixa, sem espaços duplicados. */
export const normalizarNomeItem = (nome: string | null | undefined): string =>
  (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export type ChaveItem = string;

/**
 * Chave de identidade de um item para fins de deduplicação:
 * 1. item do catálogo mestre  → `cat:<id>`
 * 2. possui código de barras  → `ean:<ean>`
 * 3. caso contrário           → `nome:<nome normalizado>`
 */
export const chaveItemFaltante = (item: {
  catalogo_mestre_id?: string | null;
  ean?: string | null;
  nome?: string | null;
  produto_id?: string | null;
}): ChaveItem => {
  if (item.catalogo_mestre_id) return `cat:${item.catalogo_mestre_id}`;
  const ean = item.ean?.trim();
  if (ean) return `ean:${ean}`;
  if (item.produto_id) return `prod:${item.produto_id}`;
  return `nome:${normalizarNomeItem(item.nome)}`;
};

export interface GrupoItens<T> {
  chave: ChaveItem;
  /** Primeiro item do grupo — usado como representante do snapshot. */
  principal: T;
  /** Soma das quantidades de todos os itens do grupo (mínimo 1). */
  quantidadeTotal: number;
  /** Quantos itens do lote caíram nesse grupo. */
  ocorrencias: number;
}

/**
 * Agrupa itens do lote de importação por identidade, somando quantidades.
 * Garante que o mesmo produto registrado várias vezes gere UMA única linha.
 */
export const agruparItensParaImportacao = <
  T extends {
    catalogo_mestre_id?: string | null;
    ean?: string | null;
    nome?: string | null;
    quantidade?: number | null;
  },
>(
  itens: T[],
): GrupoItens<T>[] => {
  const mapa = new Map<ChaveItem, GrupoItens<T>>();
  for (const item of itens) {
    const chave = chaveItemFaltante(item);
    const qtd = Math.max(1, Number(item.quantidade) || 1);
    const atual = mapa.get(chave);
    if (atual) {
      atual.quantidadeTotal += qtd;
      atual.ocorrencias += 1;
    } else {
      mapa.set(chave, { chave, principal: item, quantidadeTotal: qtd, ocorrencias: 1 });
    }
  }
  return Array.from(mapa.values());
};

/** Quantas vezes cada chave aparece numa lista (para badge "2x na lista"). */
export const contarRepeticoes = (
  itens: Array<{
    catalogo_mestre_id?: string | null;
    ean?: string | null;
    nome?: string | null;
  }>,
): Map<ChaveItem, number> => {
  const contagem = new Map<ChaveItem, number>();
  for (const item of itens) {
    const chave = chaveItemFaltante(item);
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  return contagem;
};
