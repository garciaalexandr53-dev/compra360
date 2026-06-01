import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function deriveProfileState(data: { nome?: string | null; whatsapp?: string | null } | null | undefined, isLoading = false) {
  const nome = data?.nome?.trim() || null;
  const primeiroNome = nome ? nome.split(" ")[0] || null : null;

  return {
    nome,
    primeiroNome,
    whatsapp: data?.whatsapp ?? null,
    precisaNome: !isLoading && !nome,
  };
}

export function useProfile() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
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
    ...deriveProfileState(data, isLoading),
    isLoading,
  };
}
