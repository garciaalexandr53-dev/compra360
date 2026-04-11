import { supabase } from "@/integrations/supabase/client";

export interface AiClassificationInput {
  nome: string;
}

export interface AiClassificationResult {
  nome: string;
  categoria: string;
}

interface RawClassification {
  nome?: unknown;
  categoria?: unknown;
}

const CLASSIFY_BATCH_SIZE = 60;

const normalizeText = (value: string) => value.trim().toLowerCase();

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const mapInvokeError = (message?: string) => {
  if (message?.includes("Failed to send")) {
    return "Falha ao conectar com o servidor. Tente novamente em alguns instantes.";
  }

  return message || "Erro na classificação";
};

export async function classifyProductsInBatches(
  products: AiClassificationInput[],
  existingCategories: string[],
  options?: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<AiClassificationResult[]> {
  if (!products.length) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Sessão expirada. Faça login novamente para usar a classificação por IA.");
  }

  const classificationsByName = new Map<string, AiClassificationResult>();
  const batches = chunkArray(products, options?.batchSize ?? CLASSIFY_BATCH_SIZE);
  let processed = 0;

  for (const batch of batches) {
    const resp = await supabase.functions.invoke("ai-automacao", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        type: "classify-products",
        products: batch.map((product) => ({ nome: product.nome })),
        existing_categories: existingCategories,
      },
    });

    if (resp.error) {
      throw new Error(mapInvokeError(resp.error.message));
    }

    const classifications = Array.isArray(resp.data?.classifications)
      ? resp.data.classifications
      : [];

    classifications.forEach((item: RawClassification) => {
      const nome = typeof item?.nome === "string" ? item.nome.trim() : "";
      const categoria = typeof item?.categoria === "string" ? item.categoria.trim() : "";

      if (!nome || !categoria) return;
      classificationsByName.set(normalizeText(nome), { nome, categoria });
    });

    processed += batch.length;
    options?.onProgress?.(processed, products.length);
  }

  return products
    .map((product) => classificationsByName.get(normalizeText(product.nome)))
    .filter((item): item is AiClassificationResult => Boolean(item));
}