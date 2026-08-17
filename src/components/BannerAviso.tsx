import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import PlanosModal from "@/components/PlanosModal";
import { toast } from "sonner";
import { mensagemErroFuncao } from "@/lib/functionError";

const DISMISS_KEY = "banner_trial_dismissed_session";

export default function BannerAviso() {
  const { user } = useAuth();
  const { plan, isTrial, trialDaysLeft, isPastDue, isLoading } = useSubscription();
  const [showPlanos, setShowPlanos] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1"
  );
  const [portalLoading, setPortalLoading] = useState(false);

  // Suprimir para admin
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-banner", user?.id],
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

  // Revalida via check-subscription ao montar (não bloqueia render)
  useEffect(() => {
    if (!user?.id) return;
    supabase.functions.invoke("check-subscription").catch(() => {
      /* silencioso — useSubscription mantém estado do DB */
    });
  }, [user?.id]);

  if (!user || isLoading || isAdmin) return null;

  const showPastDue = isPastDue;
  const showTrialEnding = !showPastDue && isTrial && trialDaysLeft > 0 && trialDaysLeft <= 7 && !dismissed;

  if (!showPastDue && !showTrialEnding) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não retornada");
      }
    } catch (err: any) {
      toast.error("Erro ao abrir portal: " + (await mensagemErroFuncao(err)));
    } finally {
      setPortalLoading(false);
    }
  };

  if (showPastDue) {
    return (
      <div
        role="alert"
        className="bg-destructive text-destructive-foreground border-b border-destructive/40 shadow-sm"
      >
        <div className="mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
          <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
            <p className="text-xs sm:text-sm font-medium leading-snug">
              Pagamento pendente. Atualize seu cartão para manter o acesso ao Compra360.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 text-xs shrink-0 self-stretch sm:self-auto"
            onClick={handlePortal}
            disabled={portalLoading}
          >
            {portalLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Atualizar cartão
          </Button>
        </div>
      </div>
    );
  }

  // Trial expirando
  return (
    <>
      <div
        role="status"
        className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-b border-amber-300 dark:border-amber-800"
      >
        <div className="mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
          <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
            <Clock className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
            <p className="text-xs sm:text-sm font-medium leading-snug">
              Seu trial vence em {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}. Assine agora para não perder o acesso.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
            <Button
              size="sm"
              className="h-8 text-xs flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => setShowPlanos(true)}
            >
              Assinar agora
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-amber-900 dark:text-amber-100 hover:bg-amber-200/60 dark:hover:bg-amber-900/40"
              onClick={handleDismiss}
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </>
  );
}
