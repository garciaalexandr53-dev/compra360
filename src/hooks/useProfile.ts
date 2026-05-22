import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useProfile() {
  const { user } = useAuth();
  const { data } = useQuery({
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

  const primeiroNome = data?.nome
    ? data.nome.trim().split(" ")[0] || null
    : null;

  return {
    nome: data?.nome ?? null,
    primeiroNome,
    whatsapp: data?.whatsapp ?? null,
    precisaNome: !data?.nome,
  };
}
