import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  code: string | null;
}

/** Código curto e estável a partir da mensagem, para o usuário informar ao suporte. */
const gerarCodigo = (error: Error) => {
  const base = `${error.name}:${error.message}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
};

/**
 * Evita tela branca: qualquer erro de render mostra uma tela com explicação
 * e opções de recuperação, além de registrar o erro no console.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, code: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, code: gerarCodigo(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Marcador claro para aparecer nos logs de diagnóstico.
    console.error("[Compra360][ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null, code: null });

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
          <div className="mt-5 rounded-lg bg-muted/60 px-3 py-2 text-left">
            <p className="text-[11px] font-medium text-muted-foreground">
              Código do erro: {this.state.code}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground/80">
              {`${this.state.error.name}: ${this.state.error.message}`.slice(0, 200)}
            </p>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
