import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PlanosModal from "@/components/PlanosModal";
import { PLAN_PRICES } from "@/lib/planPrices";
import { formatBRL } from "@/lib/format";

interface Props {
  totalProdutos: number;
  economiaTotal: number;
}

export default function TrialExpiredOverlay({ totalProdutos, economiaTotal }: Props) {
  const { user } = useAuth();
  const { isFree, isLoading } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hadExpiredTrial = false } = useQuery({
    queryKey: ["expired-trial", user?.id],
    enabled: !!user?.id && isFree && !isLoading,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return false;
      if (data.status !== "trialing") return false;
      return data.current_period_end
        ? new Date(data.current_period_end).getTime() <= Date.now()
        : false;
    },
  });

  if (isLoading || isAdmin || !isFree || !hadExpiredTrial) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-sm overflow-y-auto"
        style={{ top: "var(--header-h, 64px)" }}
        aria-modal="true"
        role="dialog"
      >
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md sm:max-w-lg bg-card border rounded-xl shadow-lg p-5 sm:p-8 space-y-5 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">
                Seu período grátis terminou
              </h2>
            </div>

            {(totalProdutos > 0 || economiaTotal > 0) && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold">Durante o trial você:</p>
                {totalProdutos > 0 && (
                  <p className="text-sm">
                    📊 Comparou <span className="font-bold">{totalProdutos}</span> produtos
                  </p>
                )}
                {economiaTotal > 0 && (
                  <p className="text-sm">
                    💰 Economizou{" "}
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {formatBRL(economiaTotal)}
                    </span>
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground text-center">
              Escolha um plano para continuar
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full h-12 text-sm sm:text-base"
                onClick={() => setShowPlanos(true)}
              >
                <span className="truncate">Pro {PLAN_PRICES.pro.display}{PLAN_PRICES.pro.note}</span>
              </Button>
              <Button
                className="w-full h-12 text-sm sm:text-base bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                onClick={() => setShowPlanos(true)}
              >
                <span className="truncate">Business {PLAN_PRICES.business.display}{PLAN_PRICES.business.note} ⭐</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </>
  );
}
