import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import confetti from "canvas-confetti";

interface Props {
  strategiaName: string;
  totalCompra: number;
  economiaVsMedia: number;
  numFornecedores: number;
  onDismiss: () => void;
}

const CelebracaoScreen = ({ strategiaName, totalCompra, economiaVsMedia, numFornecedores, onDismiss }: Props) => {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Fire confetti immediately
    const fire = () => {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 }, colors: ["#16a34a", "#facc15", "#ffffff", "#22c55e"] });
    };
    fire();
    const t1 = setTimeout(fire, 600);
    const t2 = setTimeout(fire, 1200);

    // Show button after 1.5s
    const t3 = setTimeout(() => setShowButton(true), 1500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-500">
      <div className="max-w-sm w-full space-y-6 text-center">
        {/* Trophy */}
        <div className="text-6xl animate-in zoom-in duration-500">🏆</div>

        {/* Title */}
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <h1 className="text-2xl font-bold text-foreground">Cotação otimizada!</h1>
          <p className="text-sm text-muted-foreground">
            Você escolheu: <span className="font-semibold text-foreground">{strategiaName}</span>
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">💰 Total da compra</div>
            <div className="text-2xl font-extrabold font-mono text-foreground">{formatBRL(totalCompra)}</div>
          </div>
          {economiaVsMedia > 0 && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <div className="text-xs text-green-700 dark:text-green-400 mb-1">🏆 Economia vs média</div>
              <div className="text-2xl font-extrabold font-mono text-green-600 dark:text-green-400">{formatBRL(economiaVsMedia)}</div>
            </div>
          )}
          <div className="bg-card border rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">📦 Fornecedores</div>
            <div className="text-2xl font-extrabold font-mono text-foreground">{numFornecedores} pedidos prontos</div>
          </div>
        </div>

        {/* Motivational */}
        <p className="text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-700 delay-500">
          Seus pedidos estão prontos para enviar.<br />
          Confira abaixo e envie pelo WhatsApp.
        </p>

        {/* Button */}
        <div className={`transition-all duration-500 ${showButton ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Button
            onClick={onDismiss}
            className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white"
          >
            Ver pedidos prontos →
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CelebracaoScreen;
