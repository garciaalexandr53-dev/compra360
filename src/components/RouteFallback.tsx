import { Loader2 } from "lucide-react";

/** Fallback visível durante o carregamento de uma rota (evita tela em branco). */
const RouteFallback = () => (
  <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-3 p-6">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">Carregando…</p>
  </div>
);

export default RouteFallback;
