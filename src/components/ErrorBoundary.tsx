import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Evita tela branca: qualquer erro de render mostra uma tela com explicação
 * e opções de recuperação, além de registrar o erro no console.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Marcador claro para aparecer nos logs de diagnóstico.
    console.error("[Compra360][ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  hardReload = () => {
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .finally(() => window.location.reload());
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">
            Algo deu errado ao abrir esta tela
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            Sua lista de itens foi salva no aparelho — nada do que você marcou foi perdido.
          </p>
          <p className="text-xs text-muted-foreground mb-5">
            Tente de novo. Se continuar, recarregue o app.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={this.reset} className="h-11 w-full">
              Tentar de novo
            </Button>
            <Button variant="outline" onClick={this.hardReload} className="h-11 w-full">
              Recarregar o app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
