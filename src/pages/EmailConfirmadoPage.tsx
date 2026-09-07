import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Seo from "@/components/Seo";
import { withAssetVersion } from "@/lib/assetVersion";

export default function EmailConfirmadoPage() {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        // Encerra a sessão criada automaticamente pelo link do e-mail:
        // o cliente deve entrar informando e-mail e senha.
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      if (!cancelado) setPronto(true);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <Seo
        title="E-mail confirmado — Compra360"
        description="Seu e-mail foi confirmado. Entre no Compra360 com seu e-mail e senha."
        path="/email-confirmado"
      />
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center">
            <img
              src={withAssetVersion(
                "https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada//logo-completa.png"
              )}
              alt="Compra360"
              className="max-w-[200px] sm:max-w-[260px] w-full h-auto object-contain"
            />
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">E-mail confirmado!</h1>
          <p className="text-sm text-muted-foreground">
            Agora entre com seu e-mail e senha para acessar o Compra360.
          </p>
          <Button asChild className="w-full" disabled={!pronto}>
            <Link to="/login">Entrar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
