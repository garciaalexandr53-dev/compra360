import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Renders a "Voltar para {lojaName}" button when the user navigated
 * from the LojaSheet (location.state.fromLoja === true).
 * Returns null otherwise.
 */
export default function BackToLojaButton({ className = "" }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as { fromLoja?: boolean; lojaName?: string };

  if (!state.fromLoja) return null;

  return (
    <button
      onClick={() => navigate(-1)}
      className={`flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="truncate">Voltar para {state.lojaName || "Lojas"}</span>
    </button>
  );
}
