import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserPlan {
  plan_name: string;
  display_name: string;
  max_lojas: number;
  max_produtos: number;
  max_fornecedores: number;
  max_cotacoes_simultaneas: number;
  features: string[];
  status: string;
  current_period_end: string | null;
}

const FREE_PLAN: UserPlan = {
  plan_name: "free",
  display_name: "Grátis",
  max_lojas: 1,
  max_produtos: 50,
  max_fornecedores: 5,
  max_cotacoes_simultaneas: 1,
  features: ["Cotação básica", "1 loja", "Até 50 produtos", "Até 5 fornecedores"],
  status: "active",
  current_period_end: null,
};

export function useSubscription() {
  const { user } = useAuth();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["user-plan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_plan", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return (data as unknown as UserPlan) ?? FREE_PLAN;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isUnlimited = (value: number) => value === -1;

  const canAdd = (current: number, limitKey: keyof Pick<UserPlan, "max_lojas" | "max_produtos" | "max_fornecedores">) => {
    const limit = (plan ?? FREE_PLAN)[limitKey];
    return isUnlimited(limit) || current < limit;
  };

  return {
    plan: plan ?? FREE_PLAN,
    isLoading,
    isPro: plan?.plan_name === "pro" || plan?.plan_name === "business",
    isBusiness: plan?.plan_name === "business",
    isFree: !plan || plan.plan_name === "free",
    isPastDue: plan?.status === "past_due",
    canAdd,
    isUnlimited,
  };
}
