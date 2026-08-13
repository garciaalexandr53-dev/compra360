import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ExternalLink, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PRICES, getStripePriceId, type Periodo } from "@/lib/stripePrices";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { PLAN_PRICES } from "@/lib/planPrices";
import { cn } from "@/lib/utils";

interface PlanosModalProps {
  open: boolean;
  onClose: () => void;
}



const plans = [
  {
    key: "free" as const,
    name: "Grátis",
    features: [
      "1 loja",
      "Até 25 produtos por cotação",
      "Até 4 fornecedores por cotação",
      "1 cotação simultânea",
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    popular: true,
    features: [
      "Até 2 lojas",
      "Até 150 produtos por cotação",
      "Até 20 fornecedores",
      "1 cotação ativa por loja",
      "IA completa (análise + sugestões)",
      "Histórico completo",
      "Suporte por WhatsApp",
    ],
  },
  {
    key: "business" as const,
    name: "Business",
    features: [
      "Lojas ilimitadas",
      "Produtos ilimitados por cotação",
      "Fornecedores ilimitados",
      "Cotações ativas ilimitadas",
      "Importação em massa (CSV/Excel)",
      "IA avançada completa",
      "Suporte prioritário",
      "Conferência de pedidos",
      "Distribuição inteligente",
    ],
  },
];

export default function PlanosModal({ open, onClose }: PlanosModalProps) {
  const { plan: currentPlan } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mensal");

  const handleCheckout = async (planKey: "pro" | "business") => {
    setLoading(planKey);
    try {
      const priceId = getStripePriceId(planKey, periodo);
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      toast.error("Erro ao iniciar checkout: " + (err.message || "tente novamente"));
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading("manage");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não retornada");
      }
    } catch (err: any) {
      toast.error("Erro ao abrir portal: " + (err.message || "tente novamente"));
    } finally {
      setLoading(null);
    }
  };

  const renderPrice = (planKey: "free" | "pro" | "business") => {
    if (planKey === "free") {
      return (
        <>
          <span className="text-2xl font-bold">{PLAN_PRICES.free.display}</span>
          <span className="text-xs text-muted-foreground">{PLAN_PRICES.free.note}</span>
        </>
      );
    }

    const plan = PLAN_PRICES[planKey];

    if (periodo === "mensal") {
      return (
        <>
          {planKey === "business" && (
            <span className="text-xs text-muted-foreground line-through mr-1">
              {PLAN_PRICES.business.originalDisplay}
            </span>
          )}
          <span className="text-2xl font-bold">{plan.display}</span>
          <span className="text-xs text-muted-foreground">{plan.note}</span>
        </>
      );
    }

    return (
      <div className="flex flex-col">
        <div>
          <span className="text-2xl font-bold">{plan.yearlyDisplay}</span>
          <span className="text-xs text-muted-foreground">{plan.yearlyNote}</span>
        </div>
        <span className="text-[11px] text-muted-foreground mt-0.5">
          ≈ {plan.yearlyMonthlyEquivalent} · {plan.yearlySavingsDisplay}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" /> Escolha seu plano
          </DialogTitle>
          <DialogDescription>
            Comece grátis e escale conforme sua necessidade
          </DialogDescription>
        </DialogHeader>

        {/* Toggle Mensal/Anual */}
        <div className="flex justify-center mt-2">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setPeriodo("mensal")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                periodo === "mensal"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={periodo === "mensal"}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setPeriodo("anual")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors inline-flex items-center gap-1",
                periodo === "anual"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={periodo === "anual"}
            >
              <span>Anual</span>
              <span aria-hidden>🔥</span>
              <span className="hidden sm:inline">Economize até 25%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {plans.map((p) => {
            const isCurrent = currentPlan.plan_name === p.key;
            const isUpgrade =
              p.key !== "free" &&
              !isCurrent &&
              (currentPlan.plan_name === "free" ||
                (currentPlan.plan_name === "pro" && p.key === "business"));

            return (
              <div
                key={p.key}
                className={`rounded-lg border p-4 flex flex-col relative ${
                  p.popular
                    ? "border-primary shadow-md ring-1 ring-primary/20"
                    : "border-border"
                } ${isCurrent ? "bg-primary/5" : ""}`}
              >
                {p.popular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                    Mais popular
                  </Badge>
                )}

                {isCurrent && (
                  <Badge variant="secondary" className="absolute -top-2.5 right-3 text-[10px]">
                    Seu plano
                  </Badge>
                )}

                <h3 className="font-semibold text-base">{p.name}</h3>

                {p.key === "business" && (
                  <Badge variant="secondary" className="mt-1 w-fit text-[10px] inline-flex items-center gap-1">
                    <Gift className="h-3 w-3" /> 30 dias grátis
                  </Badge>
                )}

                <div className="mt-2 mb-3">{renderPrice(p.key)}</div>

                <ul className="space-y-1.5 flex-1 mb-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    disabled={p.key === "free" || loading === "manage"}
                    onClick={p.key !== "free" ? handleManage : undefined}
                  >
                    {loading === "manage" ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    {p.key === "free" ? "Plano atual" : "Gerenciar assinatura"}
                    {p.key !== "free" && <ExternalLink className="h-3 w-3 ml-1" />}
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={loading === p.key}
                    onClick={() => handleCheckout(p.key as "pro" | "business")}
                  >
                    {loading === p.key ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Assinar {p.name}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="w-full text-xs" disabled>
                    —
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
