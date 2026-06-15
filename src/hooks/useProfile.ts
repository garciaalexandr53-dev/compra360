import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function normalizeNome(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

export function deriveMetadataNome(metadata: Record<string, unknown> | null | undefined): string | null {
  return (
    normalizeNome(metadata?.nome) ??
    normalizeNome(metadata?.name) ??
    normalizeNome(metadata?.full_name) ??
    normalizeNome(metadata?.display_name)
  );
}

export function deriveProfileState(
  data: { nome?: string | null; whatsapp?: string | null } | null | undefined,
  isLoading = false,
  hasLoaded = false,
  fallbackNome?: string | null,
) {
  const nome = normalizeNome(data?.nome) ?? normalizeNome(fallbackNome);
  const primeiroNome = nome ? nome.split(" ")[0] || null : null;

  return {
    nome,
    primeiroNome,
    whatsapp: data?.whatsapp ?? null,
    // Só considera que falta nome depois que a query realmente terminou
    // (evita flash do modal enquanto o perfil ainda está carregando).
    precisaNome: !isLoading && hasLoaded && !nome,
  };
}

export function useProfile() {
  const { user } = useAuth();
  const metadataNome = deriveMetadataNome(user?.user_metadata);
  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["profile-nome", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, whatsapp")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  return {
    ...deriveProfileState(data, isLoading, isFetched && !!user?.id, metadataNome),
    isLoading,
  };
}
