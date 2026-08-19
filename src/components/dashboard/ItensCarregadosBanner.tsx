import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lerCarry, limparCarry } from "@/lib/itensSemPreco";

interface Props {
  cotacaoId: string | null;
}

/**
 * Aviso na nova cotação: itens que não receberam preço na cotação anterior
 * foram carregados automaticamente. Atalho para a matriz filtrada.
 */
const ItensCarregadosBanner = ({ cotacaoId }: Props) => {
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(cotacaoId ? lerCarry(cotacaoId) : 0);
  }, [cotacaoId]);

  if (!cotacaoId || total <= 0) return null;

  const dismiss = () => {
    limparCarry(cotacaoId);
    setTotal(0);
  };

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {total} ite{total === 1 ? "m" : "ns"} da cotação anterior sem preço
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800/90 dark:text-amber-300/90">
            Nenhum fornecedor respondeu preço para {total === 1 ? "ele" : "eles"}. {total === 1 ? "Foi carregado" : "Foram carregados"} para esta cotação.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 text-xs"
            onClick={() => navigate("/cotacao?semPreco=1")}
          >
            Ver itens na cotação
          </Button>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ItensCarregadosBanner;
