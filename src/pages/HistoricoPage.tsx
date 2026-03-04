import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

const HistoricoPage = () => {
  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["cotacoes-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("*")
        .neq("status", "ativa")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables<"cotacoes">[];
    },
  });

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold mb-5">Histórico de Cotações</h1>
      
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : cotacoes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nenhuma cotação finalizada ainda.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cotacoes.map((c) => (
            <div key={c.id} className="bg-card border rounded-xl shadow-sm p-4">
              <div className="text-sm font-bold text-primary mb-2">{formatDateTime(c.created_at)}</div>
              <div className="text-xs text-muted-foreground">{c.nome}</div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  c.status === "finalizada" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  {c.status}
                </span>
                {c.finalizada_at && <span className="text-xs text-muted-foreground">{formatDateTime(c.finalizada_at)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoricoPage;
