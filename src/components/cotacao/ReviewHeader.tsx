import { CheckCircle2, CircleDot, Circle, ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ReviewHeaderProps {
  itemCount: number;
  supplierCount: number;
}

const steps = [
  { label: "Produtos", key: "produtos" },
  { label: "Fornecedores", key: "fornecedores" },
  { label: "Revisão", key: "revisao" },
  { label: "Análise", key: "analise" },
];

const ReviewHeader = ({ itemCount, supplierCount }: ReviewHeaderProps) => {
  const navigate = useNavigate();
  const currentStep = 2; // 0-indexed: Revisão

  return (
    <div className="bg-gradient-to-b from-primary/5 to-transparent">
      {/* Nav bar */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0 h-9" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="flex-1 text-center">
          <span className="text-sm font-bold text-foreground">📋 Revisão da Cotação</span>
        </div>
        <Button size="sm" className="gap-1 text-xs bg-gradient-to-r from-primary to-primary/80 shrink-0 h-9" onClick={() => navigate("/analise")}>
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress stepper */}
      <div className="px-4 py-3 flex items-center justify-center gap-0">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          const isFuture = i > currentStep;

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <CircleDot className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${
                  isDone ? "text-green-600 dark:text-green-400" : isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 sm:w-12 h-0.5 mx-1 mt-[-14px] rounded-full transition-colors ${
                  i < currentStep ? "bg-green-500" : "bg-muted"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Context banner */}
      <div className="mx-3 mb-3 p-3 rounded-lg bg-primary/8 border border-primary/15">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Revise sua cotação antes de analisar</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Edite quantidades, corrija preços ou remova itens. Quando estiver pronto, clique em "Próximo passo".
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 ml-10">
          <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {itemCount} {itemCount === 1 ? "produto" : "produtos"}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {supplierCount} {supplierCount === 1 ? "fornecedor" : "fornecedores"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReviewHeader;
