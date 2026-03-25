import { CheckCircle2 } from "lucide-react";

interface Props {
  currentStep: number; // 1-4
}

const steps = ["Produtos", "Envio", "Respostas", "Análise"];

const DashboardProgress = ({ currentStep }: Props) => {
  return (
    <div className="flex items-center gap-1 mt-6 mb-2">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 ${active ? "text-primary font-semibold" : done ? "text-green-600" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                done ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" 
                : active ? "bg-primary/10 text-primary border border-primary/30" 
                : "bg-muted text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : step}
              </div>
              <span className="text-[11px] hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded ${done ? "bg-green-400" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DashboardProgress;
