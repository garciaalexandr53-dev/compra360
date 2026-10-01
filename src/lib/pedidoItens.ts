import { supabase } from "@/integrations/supabase/client";

export interface PedidoItemSnapshot {
  produto: string;
  embalagem: string;
  fator: number;
  quantidade: number;
  preco: number;
  total: number;
}

type ItemLike = { produto: string; embalagem?: string; fator?: number; quantidade: number; preco: number; total: number };

/** Foto exata dos itens enviados ao fornecedor (o que a loja vai conferir). */
export const snapshotItens = (items: ItemLike[]): PedidoItemSnapshot[] =>
  [...items]
    .sort((a, b) => a.produto.localeCompare(b.produto))
    .map((it) => ({
      produto: it.produto,
      embalagem: it.embalagem || "UNI",
      fator: Number(it.fator) || 1,
      quantidade: Number(it.quantidade) || 0,
      preco: Number(it.preco) || 0,
      total: Number(it.total) || 0,
    }));

const assinatura = (itens: unknown) => JSON.stringify(itens ?? null);

export interface PedidoSalvo {
  id: string;
  numero: number | null;
  /** true quando substitui um pedido já enviado com itens diferentes */
  atualizado: boolean;
  versao: number;
}

/**
 * Grava/atualiza o pedido como enviado junto com a lista exata de itens.
 * Retorna null se o usuário cancelar a alteração de um pedido já conferido.
 */
export async function salvarPedidoEnviado(params: {
  cotacaoId: string;
  fornecedorId: string;
  fornecedorNome?: string;
  items: ItemLike[];
  userId?: string | null;
  lojaId?: string | null;
}): Promise<PedidoSalvo | null> {
  const itens = snapshotItens(params.items);
  const total = itens.reduce((s, it) => s + it.total, 0);
  const agora = new Date().toISOString();

  const { data: existing } = await supabase
    .from("pedidos")
    .select("id, numero, status, enviado_at, itens, versao")
    .eq("cotacao_id", params.cotacaoId)
    .eq("fornecedor_id", params.fornecedorId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const ex = existing as any;
    const jaEnviado = ex.status !== "rascunho" && !!ex.enviado_at;
    const mudou = assinatura(ex.itens) !== assinatura(itens);
    if (ex.status === "recebido" && mudou) {
      const ok = window.confirm(
        `O pedido #${ex.numero} (${params.fornecedorNome || "fornecedor"}) já foi conferido na loja.\n\nEnviar uma versão corrigida vai reabrir a conferência desse pedido. Continuar?`,
      );
      if (!ok) return null;
    }
    const atualizado = jaEnviado && mudou && !!ex.itens;
    const versao = atualizado ? (Number(ex.versao) || 1) + 1 : Number(ex.versao) || 1;
    const { data, error } = await supabase
      .from("pedidos")
      .update({ total, itens: itens as any, versao, status: (ex.status === "recebido" && !mudou ? "recebido" : "enviado") as any, enviado_at: agora } as any)
      .eq("id", ex.id)
      .select("id, numero")
      .single();
    if (error) throw error;
    return { id: data.id, numero: (data as any).numero ?? null, atualizado, versao };
  }

  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      cotacao_id: params.cotacaoId,
      fornecedor_id: params.fornecedorId,
      status: "enviado" as any,
      total,
      itens: itens as any,
      enviado_at: agora,
      created_by: params.userId ?? null,
      loja_id: params.lojaId ?? null,
    } as any)
    .select("id, numero")
    .single();
  if (error) throw error;
  return { id: data.id, numero: (data as any).numero ?? null, atualizado: false, versao: 1 };
}

export const cabecalhoAtualizado = (numero: number | null) =>
  `⚠️ *PEDIDO ATUALIZADO${numero ? ` #${numero}` : ""}* — substitui o envio anterior\n`;
