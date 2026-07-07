/**
 * Restauração ("desfazer exclusão") de um item de cotacao_produtos.
 *
 * Recebe o snapshot COMPLETO da linha original e devolve o payload de insert.
 * NÃO há fallback para `nome` — como cotacao_produtos.nome é NOT NULL,
 * qualquer snapshot sem nome deve falhar visivelmente no insert do banco
 * em vez de mascarar o problema com um placeholder.
 */

export interface UndoCotacaoProdutoSnapshot {
  cpId: string;
  cotacao_id: string;
  produto_id: string | null;
  catalogo_mestre_id: string | null;
  nome: string;
  ean: string | null;
  tipo_embalagem: string | null;
  fator_embalagem: number | null;
  quantidade: number | null;
}

export interface UndoCotacaoProdutoInsert {
  id: string;
  cotacao_id: string;
  produto_id: string | null;
  catalogo_mestre_id: string | null;
  nome: string;
  ean: string | null;
  tipo_embalagem: string | null;
  fator_embalagem: number | null;
  quantidade: number | null;
}

export const buildUndoInsert = (
  saved: UndoCotacaoProdutoSnapshot,
): UndoCotacaoProdutoInsert => ({
  id: saved.cpId,
  cotacao_id: saved.cotacao_id,
  produto_id: saved.produto_id,
  catalogo_mestre_id: saved.catalogo_mestre_id,
  nome: saved.nome,
  ean: saved.ean,
  tipo_embalagem: saved.tipo_embalagem,
  fator_embalagem: saved.fator_embalagem,
  quantidade: saved.quantidade,
});
