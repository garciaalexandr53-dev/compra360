import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto-suggest fator_embalagem for products using AI.
 * Sends product names + embalagem to the AI edge function and updates the DB.
 * Returns the number of products updated.
 */
export async function autoSuggestFator(
  products: { id: string; nome: string; embalagem: string | null; fator_embalagem: number }[],
  options?: { onProgress?: (done: number, total: number) => void; skipIfAlreadySet?: boolean }
): Promise<number> {
  // Filter to only products that need suggestion (fator = 1 or forced)
  const candidates = options?.skipIfAlreadySet
    ? products.filter(p => (p.fator_embalagem || 1) === 1)
    : products;

  if (!candidates.length) return 0;

  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    toast.error("Sessão expirada. Faça login novamente.");
    return 0;
  }

  const { data, error } = await supabase.functions.invoke("ai-automacao", {
    body: {
      type: "suggest-fator",
      products: candidates.map(p => ({
        id: p.id,
        nome: p.nome,
        embalagem: p.embalagem || "UNI",
      })),
    },
  });

  if (error) {
    console.error("autoSuggestFator error:", error);
    toast.error("Erro ao sugerir fatores de embalagem");
    return 0;
  }

  const suggestions: { id: string; fator: number; justificativa?: string }[] = data?.suggestions || [];
  let updated = 0;

  // Update products in DB
  for (const s of suggestions) {
    if (!s.id || !s.fator || s.fator < 1) continue;
    // Only update if fator changed
    const original = candidates.find(p => p.id === s.id);
    if (original && (original.fator_embalagem || 1) !== s.fator) {
      const { error: updateErr } = await supabase
        .from("produtos")
        .update({ fator_embalagem: s.fator })
        .eq("id", s.id);
      if (!updateErr) updated++;
    }
    options?.onProgress?.(updated, suggestions.length);
  }

  return updated;
}
