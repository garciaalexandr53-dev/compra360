import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UltimaCompra {
  quantidade: number;
  embalagem: string | null;
  fator: number | null;
  pedidoEm: string;
}

export interface UseUltimaCompraArgs {
  lojaId?: string | null;
  catalogoMestreId?: string | null;
  ean?: string | null;
  nome?: string | null;
  /** Só consulta quando verdadeiro (ex.: diálogo aberto). */
  enabled?: boolean;
}

/**
 * Última quantidade pedida daquele item na loja (última cotação da loja que
 * gerou pedido enviado). Casamento por catálogo mestre → EAN → nome normalizado,
 * resolvido na RPC `get_ultima_compra_item`.
 */
export const useUltimaCompra = ({
  lojaId,
  catalogoMestreId,
  ean,
  nome,
  enabled = true,
}: UseUltimaCompraArgs) => {
  const ativo = !!lojaId && !!(catalogoMestreId || ean || nome) && enabled;

  const query = useQuery<UltimaCompra | null>({
    queryKey: ["ultima-compra", lojaId, catalogoMestreId ?? null, ean ?? null, nome ?? null],
    enabled: ativo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ultima_compra_item", {
        _loja_id: lojaId!,
        _catalogo_mestre_id: catalogoMestreId ?? null,
        _ean: ean ?? null,
        _nome: nome ?? null,
      } as never);
      if (error) throw error;
      const row = ((data || []) as any[])[0];
      if (!row) return null;
      const qtd = Number(row.quantidade);
      if (!qtd || qtd <= 0) return null;
      return {
        quantidade: qtd,
        embalagem: row.tipo_embalagem ?? null,
        fator: row.fator_embalagem ?? null,
        pedidoEm: row.pedido_em,
      };
    },
  });

  return { ultimaCompra: query.data ?? null, isLoading: query.isLoading };
};
