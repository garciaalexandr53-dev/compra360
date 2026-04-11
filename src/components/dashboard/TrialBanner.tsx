import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Crown, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlanosModal from "@/components/PlanosModal";

export default function TrialBanner() {
  const { plan, isTrial, trialDaysLeft, isFree, isLoading } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);

  if (isLoading) return null;

  // Trial ativo
  if (isTrial && trialDaysLeft > 0) {
    const urgency = trialDaysLeft <= 7;
    return (
      <>
        <div
          className={`rounded-lg border p-4 mb-4 animate-fade-in ${
            urgency
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
              : "bg-primary/5 border-primary/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              urgency ? "bg-amber-100 dark:bg-amber-900/50" : "bg-primary/10"
            }`}>
              <Crown className={`h-4 w-4 ${urgency ? "text-amber-600" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${urgency ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
                Plano Business — Teste grátis
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {trialDaysLeft === 1
                  ? "Último dia do seu período de teste!"
                  : `${trialDaysLeft} dias restantes no período de teste`}
              </p>
              <Button
                size="sm"
                variant={urgency ? "default" : "outline"}
                className="mt-2 h-7 text-xs"
                onClick={() => setShowPlanos(true)}
              >
                Assinar agora
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className={`text-right shrink-0 ${urgency ? "text-amber-600" : "text-primary"}`}>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="text-xs font-mono font-bold">{trialDaysLeft}d</span>
              </div>
            </div>
          </div>
        </div>
        <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
      </>
    );
  }

  // Trial expirado, caiu para Grátis
  if (isFree) {
    return (
      <>
        <div className="rounded-lg border border-muted bg-muted/30 p-4 mb-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Crown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Plano Grátis</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Desbloqueie mais lojas, produtos e funcionalidades de IA
              </p>
              <Button
                size="sm"
                variant="default"
                className="mt-2 h-7 text-xs"
                onClick={() => setShowPlanos(true)}
              >
                Fazer upgrade
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
        <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
      </>
    );
  }

  return null;
}
