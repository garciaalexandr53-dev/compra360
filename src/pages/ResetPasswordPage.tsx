import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { withAssetVersion } from "@/lib/assetVersion";

type Estado = "verificando" | "pronto" | "invalido";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) {
      setEstado("invalido");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!cancelado && session) setEstado("pronto");
    });

    (async () => {
      for (let i = 0; i < 12; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelado) return;
        if (data.session) {
          setEstado("pronto");
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelado) setEstado("invalido");
    })();

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const podeSalvar = senha.length >= 6 && senha === senha2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) {
      const msg = /weak|guess/i.test(error.message)
        ? "A senha é muito fraca e fácil de adivinhar. Escolha outra."
        : /at least 6/i.test(error.message)
          ? "A senha deve ter pelo menos 6 caracteres."
          : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Senha atualizada! Você já está conectado.");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <Seo
        title="Definir nova senha — Compra360"
        description="Crie uma nova senha de acesso à sua conta Compra360."
        path="/reset-password"
      />
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center">
            <img
              src={withAssetVersion("https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada//logo-completa.png")}
              alt="Compra360"
              className="max-w-[200px] sm:max-w-[260px] w-full h-auto object-contain"
            />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Definir nova senha</h1>
          <CardDescription>Escolha uma nova senha para entrar no Compra360</CardDescription>
        </CardHeader>

        <CardContent>
          {estado === "verificando" && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando o link...
            </div>
          )}

          {estado === "invalido" && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Este link expirou ou já foi usado. Peça um novo link de redefinição.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => navigate("/login?recuperar=1", { replace: true })}>
                Pedir novo link
              </Button>
            </div>
          )}

          {estado === "pronto" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">Nova senha</Label>
                <Input
                  id="nova-senha" type="password" placeholder="••••••••" value={senha}
                  onChange={(e) => setSenha(e.target.value)} required minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nova-senha-2">Repita a nova senha</Label>
                <Input
                  id="nova-senha-2" type="password" placeholder="••••••••" value={senha2}
                  onChange={(e) => setSenha2(e.target.value)} required minLength={6}
                  autoComplete="new-password"
                />
                {senha2.length > 0 && senha !== senha2 && (
                  <p className="text-xs text-destructive">As senhas não são iguais.</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] hover:opacity-90"
                disabled={!podeSalvar || salvando}
              >
                {salvando ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
