import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScanState = "requesting" | "scanning" | "denied" | "unsupported" | "error";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/**
 * Leitor de código de barras de produto (EAN-13, EAN-8, UPC-A/E). QR code é ignorado.
 *
 * Cuidados essenciais (causaram tela de erro no App Reposição):
 * - A biblioteca `html5-qrcode` manipula o DOM por conta própria. O elemento do
 *   vídeo é criado imperativamente dentro de um contêiner vazio, para que o React
 *   nunca dispute os mesmos nós — do contrário a remoção falha com erro de DOM.
 * - Ao reconhecer um código a câmera é encerrada ANTES de entregar o código e
 *   fechar o modal: nunca desmontar a tela dentro da callback da biblioteca.
 * - As callbacks são lidas por referência, então a câmera não reinicia a cada
 *   digitação do usuário no campo de busca.
 */
const BarcodeScannerModal = ({ open, onClose, onDetected }: BarcodeScannerModalProps) => {
  const [state, setState] = useState<ScanState>("requesting");
  const [attempt, setAttempt] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<any>(null);
  const detectedRef = useRef(false);

  // Callbacks por referência: evitam reinício da câmera quando o pai re-renderiza.
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;

  /** Para e limpa o scanner, sempre sem lançar erro. */
  const encerrarScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* já parado ou nunca iniciado */
    }
    try {
      scanner.clear();
    } catch {
      /* nada a limpar */
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    detectedRef.current = false;
    setState("requesting");

    // Nó dedicado à biblioteca — fora do controle de renderização do React.
    const host = hostRef.current;
    const regionId = `barcode-scanner-region-${Math.random().toString(36).slice(2)}`;
    let region: HTMLDivElement | null = null;
    if (host) {
      host.innerHTML = "";
      region = document.createElement("div");
      region.id = regionId;
      region.className = "w-full";
      host.appendChild(region);
    }

    const finalizarLeitura = (code: string) => {
      // Encerra a câmera primeiro; só depois mexe no estado do React.
      void encerrarScanner().finally(() => {
        onDetectedRef.current(code);
        onCloseRef.current();
      });
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !region) {
        if (!cancelled) setState(region ? "unsupported" : "error");
        return;
      }
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 }, aspectRatio: 1.3333 },
          (decodedText: string) => {
            const code = (decodedText || "").replace(/\D/g, "");
            // Aceita apenas a primeira leitura válida.
            if (!code || detectedRef.current || cancelled) return;
            detectedRef.current = true;
            finalizarLeitura(code);
          },
          () => {
            /* leitura em andamento — ignorar falhas por frame */
          },
        );
        if (cancelled) {
          void encerrarScanner();
          return;
        }
        setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name || "";
        const msg = String((err as Error)?.message || err);
        if (name === "NotAllowedError" || /permission|denied/i.test(msg)) setState("denied");
        else if (name === "NotFoundError" || /not found|no camera/i.test(msg)) setState("unsupported");
        else setState("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      // Aguarda o encerramento antes de descartar o nó que a biblioteca usa.
      void encerrarScanner().finally(() => {
        if (region?.parentNode) region.parentNode.removeChild(region);
      });
    };
    // Depende apenas de abrir/fechar e da tentativa manual — nunca das callbacks.
  }, [open, attempt, encerrarScanner]);

  if (!open) return null;

  const isFallback = state === "denied" || state === "unsupported" || state === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4" /> Escanear código de barras
          </p>
          <button
            onClick={onClose}
            aria-label="Fechar scanner"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          {/* Contêiner estável: conteúdo gerenciado pela biblioteca, nunca pelo React. */}
          <div
            ref={hostRef}
            aria-hidden={isFallback}
            className={`w-full ${isFallback ? "h-0 overflow-hidden" : "block"} [&_video]:w-full [&_video]:max-h-[60vh] [&_video]:object-cover`}
          />

          {state === "requesting" && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Permita o acesso à câmera para escanear</p>
            </div>
          )}

          {state === "scanning" && (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[140px] w-[260px] max-w-[80%] rounded-lg border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <span className="flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando código...
                </span>
              </div>
            </>
          )}

          {isFallback && (
            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {state === "error"
                  ? "Não foi possível ler o código. Tente novamente ou digite o código de barras no campo de busca."
                  : "Sem acesso à câmera. Digite o código de barras no campo de busca."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                  Tentar de novo
                </Button>
                <Button size="sm" onClick={onClose}>
                  Voltar ao campo
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
          Aponte para o código de barras do produto (EAN-13, EAN-8, UPC)
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
