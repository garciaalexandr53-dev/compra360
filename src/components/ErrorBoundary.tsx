import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wifi, RefreshCw, MessageCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  code: string | null;
}

const WHATSAPP_SUPORTE = "5544984483553";

/** Código curto e estável a partir da mensagem, para o usuário informar ao suporte. */
const gerarCodigo = (error: Error) => {
  const base = `${error.name}:${error.message}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
};

/**
 * Evita tela branca: qualquer erro de render mostra uma tela com orientação
 * clara do que fazer (internet, recarregar, suporte), além de registrar o erro.
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

  abrirSuporte = () => {
    const texto = encodeURIComponent(
      `Olá! Estou com um erro no Compra360. Código: ${this.state.code ?? "—"}.`
    );
    window.open(`https://wa.me/${WHATSAPP_SUPORTE}?text=${texto}`, "_blank", "noopener,noreferrer");
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
            Não conseguimos abrir esta tela
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Isso costuma acontecer quando a internet oscila ou o sinal caiu no meio do carregamento.
          </p>

          <div className="rounded-lg bg-muted/60 px-4 py-3 text-left mb-5 space-y-2">
            <p className="text-xs font-semibold text-foreground">O que fazer agora:</p>
            <div className="flex items-start gap-2">
              <Wifi className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">1.</span> Verifique se o Wi-Fi ou os dados móveis estão funcionando.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">2.</span> Toque em <span className="font-medium text-foreground">Recarregar o app</span> abaixo.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">3.</span> Se continuar, fale com a gente no WhatsApp informando o código do erro.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={this.hardReload} className="h-11 w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar o app
            </Button>
            <Button variant="outline" onClick={this.abrirSuporte} className="h-11 w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com o suporte
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
