import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";

const DISMISS_KEY = "discovery_app_funcionarios_dismissed";

const AppFuncionariosDiscoveryCard = () => {
  const navigate = useNavigate();
  const { lojas } = useLojaAtiva();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1"
  );

  const lojaIds = lojas.map((l) => l.id);

  const { data: usouRecurso } = useQuery({
    queryKey: ["itens-faltantes-existe", lojaIds],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("itens_faltantes")
        .select("id", { count: "exact", head: true })
        .in("loja_id", lojaIds);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !dismissed && lojaIds.length > 0,
  });

  if (dismissed || lojaIds.length === 0 || usouRecurso !== false) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="mb-5 border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground pr-6">
              Sua equipe pode registrar o que está faltando
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Envie um link pelo WhatsApp para os funcionários da loja. Eles marcam os
              produtos em falta pelo celular — sem instalar nada — e você importa tudo
              para a cotação com um toque.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full sm:w-auto"
              onClick={() => navigate("/funcionarios")}
            >
              Enviar link para a equipe
            </Button>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dispensar"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppFuncionariosDiscoveryCard;
