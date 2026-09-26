import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HistoricoPreco } from "@/lib/precoHistorico";

export function useHistoricoPrecos(lojaId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["historico-precos-loja", lojaId],
    enabled: !!lojaId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_historico_precos_loja", { _loja_id: lojaId });
      if (error) throw error;
      const map = new Map<string, HistoricoPreco>();
      for (const r of (data ?? []) as any[]) {
        map.set(r.chave, {
          ...r,
          ultimo_preco: Number(r.ultimo_preco),
          media: Number(r.media),
          amostras: Number(r.amostras),
        });
      }
      return map;
    },
  });
}
