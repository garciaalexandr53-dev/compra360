import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PLANS } from "@/lib/stripePlans";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { PLAN_PRICES, getPlanPriceDisplay } from "@/lib/planPrices";

interface PlanosModalProps {
  open: boolean;
  onClose: () => void;
}

const plans = [
  {
    key: "free" as const,
    name: "Grátis",
    price: PLAN_PRICES.free.display,
    priceNote: PLAN_PRICES.free.note,
    features: [
      "1 loja",
      "Até 50 produtos",
      "Até 5 fornecedores",
      "1 cotação simultânea",
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: PLAN_PRICES.pro.display,
    priceNote: PLAN_PRICES.pro.note,
    popular: true,
    features: [
      "Cotações ilimitadas",
      "Fornecedores ilimitados",
      "Até 500 produtos",
      "IA completa (análise + sugestões)",
      "Importação em massa (CSV/Excel)",
      "Histórico completo",
      "Suporte por WhatsApp",
    ],
  },
  {
    key: "business" as const,
    name: "Business",
    price: PLAN_PRICES.business.display,
    priceNote: PLAN_PRICES.business.note,
    originalPrice: PLAN_PRICES.business.originalDisplay,
    features: [
      "Lojas ilimitadas",
      "Produtos ilimitados",
      "Fornecedores ilimitados",
      "Cotações ilimitadas",
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

  const handleCheckout = async (planKey: "pro" | "business") => {
    setLoading(planKey);
    try {
      const priceId = STRIPE_PLANS[planKey].price_id;
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

                <div className="mt-2 mb-3">
                  {p.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through mr-1">
                      {p.originalPrice}
                    </span>
                  )}
                  <span className="text-2xl font-bold">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.priceNote}</span>
                </div>

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
