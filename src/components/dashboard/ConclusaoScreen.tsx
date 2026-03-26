import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, History, BarChart3, RefreshCw, X } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import confetti from "canvas-confetti";

type Fornecedor = Tables<"fornecedores">;

interface PedidoResumo {
  fornecedorNome: string;
  total: number;
}

interface Props {
  economyEstimate: number | null;
  pedidos: PedidoResumo[];
  onNewCotacao: () => void;
  onDismiss: () => void;
}

const AnimatedNumber = ({ value, duration = 1500 }: { value: number; duration?: number }) => {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value <= 0) return;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = eased * value;
      setCurrent(val);
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);

  return <>{formatBRL(current)}</>;
};

const ConclusaoScreen = ({ economyEstimate, pedidos, onNewCotacao, onDismiss }: Props) => {
  const navigate = useNavigate();
  const [showIcon, setShowIcon] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  const totalGeral = pedidos.reduce((s, p) => s + p.total, 0);

  useEffect(() => {
    const t1 = setTimeout(() => setShowIcon(true), 100);
    const t2 = setTimeout(() => {
      setShowTitle(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#34d399", "#6ee7b7", "#059669"] });
    }, 400);
    const t3 = setTimeout(() => setShowEconomy(true), 900);
    const t4 = setTimeout(() => setShowList(true), 1400);
    const t5 = setTimeout(() => setShowButtons(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-5 overflow-y-auto">
      <button onClick={onDismiss} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10">
        <X className="h-5 w-5" />
      </button>

      <div className="max-w-md w-full space-y-6 py-8">
        {/* Icon */}
        <div className={`flex justify-center transition-all duration-500 ${showIcon ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}>
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Title */}
        <div className={`text-center transition-all duration-500 ${showTitle ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 className="text-2xl font-bold text-foreground">Compra finalizada! 🎉</h1>
          <p className="text-sm text-muted-foreground mt-1">Pedidos enviados para todos os fornecedores</p>
        </div>

        {/* Economy card */}
        {economyEstimate && economyEstimate > 0 && (
          <div className={`transition-all duration-500 ${showEconomy ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Card className="border-green-500/30 bg-green-950/20 dark:bg-green-950/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-green-400/80 mb-1">Você economizou</p>
                <p className="text-3xl font-bold text-green-400">
                  <AnimatedNumber value={economyEstimate} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">comparado ao fornecedor mais caro desta cotação</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pedidos list */}
        <div className={`transition-all duration-500 ${showList ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Card>
            <CardContent className="p-4 space-y-2">
              {pedidos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="flex-1 truncate text-foreground">{p.fornecedorNome}</span>
                  <span className="text-muted-foreground font-medium">{formatBRL(p.total)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold text-foreground">
                <span>Total da compra</span>
                <span>{formatBRL(totalGeral)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Buttons */}
        <div className={`space-y-3 transition-all duration-500 ${showButtons ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Button className="w-full h-12 text-base gap-2 bg-gradient-to-r from-primary to-primary/80" onClick={onNewCotacao}>
            <RefreshCw className="h-5 w-5" /> Nova cotação
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/historico")}>
              <History className="h-4 w-4" /> Ver histórico
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/analise")}>
              <BarChart3 className="h-4 w-4" /> Ver análise
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConclusaoScreen;
