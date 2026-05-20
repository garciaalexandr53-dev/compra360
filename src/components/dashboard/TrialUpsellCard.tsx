import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Gift, AlertTriangle, Flame } from "lucide-react";
import PlanosModal from "@/components/PlanosModal";
import { formatBRL } from "@/lib/format";

interface Props {
  totalProdutos: number;
  economiaTotal: number;
}

export default function TrialUpsellCard({ totalProdutos, economiaTotal }: Props) {
  const { user } = useAuth();
  const { isTrial, trialDaysLeft } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);
  const [showModal, setShowModal] = useState(false);

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

  // Modal trigger on days 20-25 of trial (5 < days_left <= 10), one shot per day
  useEffect(() => {
    if (!isTrial || isAdmin) return;
    if (trialDaysLeft > 5 && trialDaysLeft <= 10) {
      const key = `upsell-modal-dia-${trialDaysLeft}`;
      try {
        if (!localStorage.getItem(key)) {
          setShowModal(true);
          localStorage.setItem(key, "1");
        }
      } catch {
        /* ignore */
      }
    }
  }, [isTrial, trialDaysLeft, isAdmin]);

  if (!isTrial || isAdmin || trialDaysLeft <= 0) return null;

  const moderate = trialDaysLeft > 5 && trialDaysLeft <= 10;
  const high = trialDaysLeft > 0 && trialDaysLeft <= 5;

  return (
    <>
      {high ? (
        <Card className="mb-4 border-destructive/40 bg-destructive/5 animate-pulse">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-semibold text-destructive">
                {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"} para o trial acabar
              </p>
            </div>
            {economiaTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                💰 Você economizou{" "}
                <span className="font-bold text-foreground">{formatBRL(economiaTotal)}</span>
              </p>
            )}
            <Button size="sm" className="w-full gap-2" onClick={() => setShowPlanos(true)}>
              <Flame className="h-4 w-4" /> Ativar agora para não perder o acesso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4 border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Gift className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm font-semibold">
                🎁 Business grátis · {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}
              </p>
            </div>
            {totalProdutos > 0 && (
              <p className="text-xs text-muted-foreground">
                Você já comparou{" "}
                <span className="font-bold text-foreground">{totalProdutos}</span> produtos
              </p>
            )}
            {economiaTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                💰 Economia estimada:{" "}
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatBRL(economiaTotal)}
                </span>
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setShowPlanos(true)}
            >
              Ativar plano agora →
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showModal && moderate} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {economiaTotal > 0
                ? `Você já economizou ${formatBRL(economiaTotal)} 🎉`
                : "Continue aproveitando o Compra360 🎉"}
            </DialogTitle>
            <DialogDescription>
              {economiaTotal > 0 ? "usando o Compra360. " : ""}Continue sem interrupções:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            <li>✔ Histórico completo</li>
            <li>✔ Automação de pedidos</li>
            <li>✔ Produtos ilimitados</li>
          </ul>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Agora não
            </Button>
            <Button
              onClick={() => {
                setShowModal(false);
                setShowPlanos(true);
              }}
            >
              Ativar Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </>
  );
}
