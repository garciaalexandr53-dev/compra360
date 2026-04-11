import { useState, ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PlanosModal from "@/components/PlanosModal";

type PlanTier = "free" | "pro" | "business";

interface FeatureGateProps {
  /** Minimum plan required: "pro" or "business" */
  requiredPlan?: PlanTier;
  /** Or check a numeric limit */
  limitKey?: "max_lojas" | "max_produtos" | "max_fornecedores" | "max_cotacoes_simultaneas";
  currentCount?: number;
  /** Label shown in toast/tooltip */
  featureLabel?: string;
  children: ReactNode;
  /** Render as overlay lock instead of wrapping onClick */
  mode?: "disable" | "overlay";
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, business: 2 };

const PLAN_LABELS: Record<string, string> = {
  pro: "Pro",
  business: "Business",
};

export default function FeatureGate({
  requiredPlan,
  limitKey,
  currentCount,
  featureLabel = "Esta funcionalidade",
  children,
  mode = "disable",
}: FeatureGateProps) {
  const { plan, canAdd } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);

  // Check if the feature is locked
  let isLocked = false;
  let lockReason = "";

  if (requiredPlan) {
    const userRank = PLAN_RANK[plan.plan_name] ?? 0;
    const requiredRank = PLAN_RANK[requiredPlan] ?? 0;
    if (userRank < requiredRank) {
      isLocked = true;
      lockReason = `${featureLabel} requer o plano ${PLAN_LABELS[requiredPlan] || requiredPlan}`;
    }
  }

  if (limitKey && currentCount !== undefined) {
    if (!canAdd(currentCount, limitKey as any)) {
      isLocked = true;
      const limit = plan[limitKey];
      lockReason = `Limite atingido: ${currentCount}/${limit === -1 ? "∞" : limit}. Faça upgrade para adicionar mais.`;
    }
  }

  const handleLockedClick = () => {
    toast.error(lockReason, {
      action: {
        label: "Ver planos",
        onClick: () => setShowPlanos(true),
      },
    });
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  if (mode === "overlay") {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none select-none">{children}</div>
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg cursor-pointer"
          onClick={() => setShowPlanos(true)}
        >
          <Button variant="outline" size="sm" className="gap-2 shadow-sm">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs">{PLAN_LABELS[requiredPlan!] || "Upgrade"}</span>
            <Crown className="h-3.5 w-3.5 text-amber-500" />
          </Button>
        </div>
        <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
      </div>
    );
  }

  // mode === "disable" — wrap children click
  return (
    <>
      <div onClick={handleLockedClick} className="cursor-pointer inline-flex">
        <div className="pointer-events-none opacity-60">{children}</div>
      </div>
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </>
  );
}

/** Hook for imperative gating checks */
export function useFeatureCheck() {
  const { plan, canAdd, isPro, isBusiness } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);

  const checkLimit = (
    limitKey: "max_lojas" | "max_produtos" | "max_fornecedores" | "max_cotacoes_simultaneas",
    currentCount: number,
    label?: string
  ): boolean => {
    if (canAdd(currentCount, limitKey as any)) return true;
    const limit = plan[limitKey];
    toast.error(
      `Limite atingido: ${currentCount}/${limit === -1 ? "∞" : limit}. ${label || "Faça upgrade para continuar."}`,
      { action: { label: "Ver planos", onClick: () => setShowPlanos(true) } }
    );
    return false;
  };

  const checkPlan = (required: PlanTier, label?: string): boolean => {
    const userRank = PLAN_RANK[plan.plan_name] ?? 0;
    const requiredRank = PLAN_RANK[required] ?? 0;
    if (userRank >= requiredRank) return true;
    toast.error(
      `${label || "Esta funcionalidade"} requer o plano ${PLAN_LABELS[required] || required}`,
      { action: { label: "Ver planos", onClick: () => setShowPlanos(true) } }
    );
    return false;
  };

  return { checkLimit, checkPlan, showPlanos, setShowPlanos, isPro, isBusiness, plan };
}
