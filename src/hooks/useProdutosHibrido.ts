import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProdutoHibrido } from "@/lib/buscaProdutos";

/**
 * Fonte ÚNICA da busca híbrida (catálogo global + produtos locais) usada pela
 * tela de adicionar produtos à cotação. Consome a RPC `search_produtos_hibrido`
 * via supabase client autenticado (JWT do usuário → auth.uid() não-nulo).
 *
 * Retorna o array já agrupado pela RPC (catálogo primeiro, locais depois).
 */
export interface UseProdutosHibridoOptions {
  termo: string;
  /** Tamanho mínimo do termo (default 2). */
  minLength?: number;
  /** Limite repassado à RPC (default 50). */
  limit?: number;
}

export interface UseProdutosHibridoResult {
  data: ProdutoHibrido[];
  catalogo: ProdutoHibrido[];
  locais: ProdutoHibrido[];
  isLoading: boolean;
  error: unknown;
}

export const useProdutosHibrido = ({
  termo,
  minLength = 2,
  limit = 50,
}: UseProdutosHibridoOptions): UseProdutosHibridoResult => {
  const termoTrim = termo.trim();
  const enabled = termoTrim.length >= minLength;

  const query = useQuery<ProdutoHibrido[]>({
    queryKey: ["produtos-hibrido-search", termoTrim, limit],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_produtos_hibrido", {
        _termo: termoTrim,
        _limit: limit,
      });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        fonte: r.fonte as "catalogo" | "local",
        id: r.id,
        nome: r.nome,
        ean: r.ean ?? null,
        embalagem: r.embalagem ?? null,
        fator_embalagem: r.fator_embalagem ?? null,
      }));
    },
  });

  const data = query.data ?? [];
  return {
    data,
    catalogo: data.filter((r) => r.fonte === "catalogo"),
    locais: data.filter((r) => r.fonte === "local"),
    isLoading: query.isLoading,
    error: query.error,
  };
};
