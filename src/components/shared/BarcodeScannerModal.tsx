import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScanState = "requesting" | "scanning" | "denied" | "unsupported" | "error";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const CONTAINER_ID = "barcode-scanner-region";

/** Somente códigos de barras de produto (EAN-13, EAN-8, UPC-A/E). QR code é ignorado. */
const BarcodeScannerModal = ({ open, onClose, onDetected }: BarcodeScannerModalProps) => {
  const [state, setState] = useState<ScanState>("requesting");
  const [attempt, setAttempt] = useState(0);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    detectedRef.current = false;
    setState("requesting");

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(CONTAINER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });
        scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 }, aspectRatio: 1.3333 },
          (decodedText) => {
            const code = (decodedText || "").replace(/\D/g, "");
            if (!code || detectedRef.current) return;
            detectedRef.current = true;
            onDetected(code);
            onClose();
          },
          () => {
            /* leitura em andamento — ignorar falhas por frame */
          },
        );
        if (!cancelled) setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name || "";
        const msg = String((err as Error)?.message || err);
        if (name === "NotAllowedError" || /permission|denied/i.test(msg)) setState("denied");
        else if (name === "NotFoundError" || /not found|no camera/i.test(msg)) setState("unsupported");
        else setState("error");
      }
    };

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* já parado */
          });
      }
    };
  }, [open, attempt, onDetected, onClose]);

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
          <div
            id={CONTAINER_ID}
            className={`w-full ${isFallback ? "hidden" : "block"} [&_video]:w-full [&_video]:max-h-[60vh] [&_video]:object-cover`}
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
