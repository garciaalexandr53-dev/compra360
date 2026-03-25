import { AlertCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  itensFaltantes: number;
  pedidosPendentes: number;
}

const DashboardAlerts = ({ itensFaltantes, pedidosPendentes }: Props) => {
  const navigate = useNavigate();
  if (itensFaltantes === 0 && pedidosPendentes === 0) return null;

  return (
    <div className="space-y-2 mb-4 animate-fade-in">
      {itensFaltantes > 0 && (
        <button onClick={() => navigate("/funcionarios")} className="w-full flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-left hover:shadow-sm transition-shadow">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-300">{itensFaltantes} item(ns) faltantes aguardando importação</span>
        </button>
      )}
      {pedidosPendentes > 0 && (
        <button onClick={() => navigate("/analise")} className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-left hover:shadow-sm transition-shadow">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm text-blue-800 dark:text-blue-300">{pedidosPendentes} pedido(s) aguardando confirmação</span>
        </button>
      )}
    </div>
  );
};

export default DashboardAlerts;
