import { supabase } from "@/integrations/supabase/client";
import { assinaturaCabecalho, mesclarFormatos, type Mapeamento } from "@/lib/planilhaImport";

const lojaAtivaId = () => {
  try {
    return localStorage.getItem("loja_ativa_id");
  } catch {
    return null;
  }
};

/** Traz os formatos salvos na loja ativa para a cópia local. Falha em silêncio. */
export const sincronizarFormatos = async (escopo: string) => {
  const loja = lojaAtivaId();
  if (!loja) return;
  const { data, error } = await supabase
    .from("formatos_planilha" as never)
    .select("assinatura, mapeamento, updated_at")
    .eq("loja_id", loja)
    .eq("escopo", escopo);
  if (error || !data) return;
  mesclarFormatos(
    escopo,
    (data as { assinatura: string; mapeamento: Mapeamento; updated_at: string }[]).map((r) => ({
      assinatura: r.assinatura,
      mapeamento: r.mapeamento,
      usadoEm: new Date(r.updated_at).getTime(),
    })),
  );
};

/** Grava o formato na loja ativa (nuvem). */
export const salvarFormatoNuvem = async (
  escopo: string,
  rows: unknown[][],
  linhaCabecalho: number,
  mapeamento: Mapeamento,
) => {
  const loja = lojaAtivaId();
  const assinatura = assinaturaCabecalho(rows, linhaCabecalho);
  if (!loja || !assinatura.replace(/\|/g, "")) return;
  await supabase
    .from("formatos_planilha" as never)
    .upsert({ loja_id: loja, escopo, assinatura, mapeamento } as never, {
      onConflict: "loja_id,escopo,assinatura",
    });
};
