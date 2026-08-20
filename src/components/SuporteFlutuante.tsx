import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";
import { buildSuporteUrl } from "@/lib/suporte";

export function SuporteFlutuante() {
  const { user } = useAuth();
  const { nome } = useProfile();
  const { plan } = useSubscription();
  const { lojaAtiva } = useLojaAtiva();

  const url = buildSuporteUrl({
    nome,
    email: user?.email,
    plano: plan?.display_name,
    loja: lojaAtiva?.nome,
  });


  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o suporte pelo WhatsApp"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 z-40 md:bottom-6 md:right-6"
    >
      <Button
        size="icon"
        className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    </a>
  );
}
