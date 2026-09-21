import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const detectIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIphoneOrIpad = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se apresenta como Mac com suporte a toque
  const isIpadDesktopUa =
    /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return isIphoneOrIpad || isIpadDesktopUa;
};

const detectStandalone = () => {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
  return displayMode || iosStandalone;
};

/**
 * Estado de instalação do app (PWA).
 * - Android/desktop: usa o evento nativo `beforeinstallprompt`.
 * - iOS: não existe API de instalação; devolvemos `isIos` para exibir as instruções manuais.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => detectStandalone());
  const [isIos] = useState(() => detectIos());

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Dispara o instalador nativo. Retorna false quando não há prompt (iOS ou navegador embutido). */
  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return true;
  }, [deferredPrompt]);

  return {
    /** Já está rodando como app instalado — esconder o botão. */
    isInstalled,
    /** Aparelho Apple: mostrar instruções manuais. */
    isIos,
    /** Instalação com 1 toque disponível. */
    canInstall: !!deferredPrompt,
    install,
  };
}
