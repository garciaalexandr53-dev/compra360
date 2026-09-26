import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, ArrowRight } from "lucide-react";

export type CockpitAcao = {
  /** Selo curto no canto (ex.: "Ao vivo", "Pronto") */
  selo?: string;
  /** Tom visual do card */
  tom: "neutro" | "atencao" | "sucesso";
  /** Frase principal do próximo passo */
  titulo: string;
  /** Detalhe complementar em uma linha */
  descricao?: string;
  /** Texto do botão principal */
  botao: string;
  onClick: () => void;
  /** Ação secundária opcional */
  secundario?: { label: string; onClick: () => void };
};

const TONS: Record<CockpitAcao["tom"], { card: string; icone: string; selo: string }> = {
  neutro: {
    card: "border-primary/30 bg-primary/5",
    icone: "bg-primary/10 text-primary",
    selo: "bg-primary/10 text-primary border-primary/20",
  },
  atencao: {
    card: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/20",
    icone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    selo: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  sucesso: {
    card: "border-green-500/30 bg-green-50 dark:bg-green-950/20",
    icone: "bg-green-500/10 text-green-600 dark:text-green-400",
    selo: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  },
};

const CockpitCard = ({ acao }: { acao: CockpitAcao | null }) => {
  if (!acao) return null;
  const t = TONS[acao.tom];

  return (
    <Card className={`mb-4 border shadow-sm animate-fade-in ${t.card}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${t.icone}`}>
            <Compass className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Próximo passo
          </span>
          {acao.selo && (
            <Badge variant="secondary" className={`ml-auto shrink-0 text-[10px] px-2 py-0.5 ${t.selo}`}>
              {acao.selo}
            </Badge>
          )}
        </div>

        <div>
          <p className="text-base font-bold text-foreground leading-snug">{acao.titulo}</p>
          {acao.descricao && (
            <p className="text-xs text-muted-foreground mt-1">{acao.descricao}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1 h-11 gap-2 text-sm" onClick={acao.onClick}>
            {acao.botao}
            <ArrowRight className="h-4 w-4" />
          </Button>
          {acao.secundario && (
            <Button
              variant="outline"
              className="h-11 text-sm sm:w-auto"
              onClick={acao.secundario.onClick}
            >
              {acao.secundario.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CockpitCard;
