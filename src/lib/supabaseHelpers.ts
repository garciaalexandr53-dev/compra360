import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all rows from a table, bypassing the default 1000-row limit.
 * Uses pagination with .range() to fetch in batches.
 */
async function fetchAllRows<T = Record<string, unknown>>(
  tableName: string,
  selectColumns: string,
  filters?: (query: any) => any,
  batchSize = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(tableName)
      .select(selectColumns)
      .range(from, from + batchSize - 1);

    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data as T[]);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allData;
}

/**
 * Fetches all product names for duplicate checking.
 * Returns a Set of lowercase trimmed names.
 */
export async function fetchAllProductNames(
  filters?: (query: any) => any
): Promise<Set<string>> {
  const products = await fetchAllRows<{ nome: string }>(
    "produtos",
    "nome",
    filters
  );
  return new Set(products.map((p) => p.nome.toLowerCase().trim()));
}

/**
 * Fetches all products with id and nome for matching.
 * Returns a Map of lowercase trimmed name → { id, nome }.
 */
export async function fetchAllProductsMap(
  filters?: (query: any) => any
): Promise<Map<string, { id: string; nome: string }>> {
  const products = await fetchAllRows<{ id: string; nome: string }>(
    "produtos",
    "id, nome",
    filters
  );
  return new Map(products.map((p) => [p.nome.toLowerCase().trim(), p]));
}

/**
 * Fetches all used categoria_ids from produtos for a given user.
 * Returns a Set of categoria_id strings.
 */
export async function fetchAllUsedCategoryIds(userId: string): Promise<Set<string>> {
  const products = await fetchAllRows<{ categoria_id: string | null }>(
    "produtos",
    "categoria_id",
    (q) => q.eq("user_id", userId).not("categoria_id", "is", null)
  );
  return new Set(products.map((p) => p.categoria_id).filter(Boolean) as string[]);
}
