import { supabase } from "@/integrations/supabase/client";

type Buscar = (lojaId: string | null) => Promise<string | null>;

const buscarPadrao: Buscar = async (lojaId) => {
  let q = supabase.from("cotacoes").select("prazo_resposta").eq("status", "ativa");
  q = lojaId ? q.eq("loja_id", lojaId) : q.is("loja_id", null);
  const { data } = await q.limit(1).maybeSingle();
  return (data as any)?.prazo_resposta ?? null;
};

/**
 * Garante o prazo de fechamento antes de montar a mensagem do WhatsApp.
 * Se a tela ainda não tiver o prazo (aba recarregada no celular), lê direto do banco.
 */
export async function obterPrazoCotacao(
  atual: string | null | undefined,
  lojaId: string | null | undefined,
  buscar: Buscar = buscarPadrao,
): Promise<string | null> {
  if (atual) return atual;
  try {
    return await buscar(lojaId ?? null);
  } catch {
    return null;
  }
}

/** Consulta de cotação ativa só roda depois que a loja estiver definida. */
export function lojaPronta(loading: boolean, lojas: unknown[], lojaAtiva: unknown): boolean {
  return !loading && (lojas.length === 0 || !!lojaAtiva);
}
