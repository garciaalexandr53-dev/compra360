import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ModalNovaCotacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novaCotacaoOpt: "manter" | "manter_precos" | "zerar" | null;
  setNovaCotacaoOpt: (opt: "manter" | "manter_precos" | "zerar" | null) => void;
  onConfirm: () => void;
  loading?: boolean;
  lojaId?: string | null;
}

const ModalNovaCotacao = ({ open, onOpenChange, novaCotacaoOpt, setNovaCotacaoOpt, onConfirm, loading, lojaId }: ModalNovaCotacaoProps) => {
  const [importedCount, setImportedCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowWarning(false);
      return;
    }
    // Check for imported items linked to this store
    const check = async () => {
      let query = supabase
        .from("itens_faltantes")
        .select("id, created_at", { count: "exact" })
        .eq("importado", true);
      if (lojaId) query = query.eq("loja_id", lojaId);

      const { count } = await query;
      setImportedCount(count || 0);

      // Recent items (< 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      let recentQuery = supabase
        .from("itens_faltantes")
        .select("id", { count: "exact" })
        .eq("importado", true)
        .gte("created_at", sevenDaysAgo.toISOString());
      if (lojaId) recentQuery = recentQuery.eq("loja_id", lojaId);

      const { count: rc } = await recentQuery;
      setRecentCount(rc || 0);
    };
    check();
  }, [open, lojaId]);

  const handleConfirm = () => {
    // Show warning if there are imported items and user hasn't acknowledged yet
    const needsWarning = novaCotacaoOpt === "zerar"
      ? recentCount > 0
      : importedCount > 0;

    if (needsWarning && !showWarning) {
      setShowWarning(true);
      return;
    }
    onConfirm();
  };

  const isZerar = novaCotacaoOpt === "zerar";
  const warningItems = isZerar ? recentCount : importedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔄 Nova Cotação</DialogTitle>
        </DialogHeader>

        {!showWarning ? (
          <>
            <p className="text-sm text-muted-foreground">Salva o histórico atual e reinicia a cotação</p>
            <p className="text-sm text-foreground mt-2">O que deseja fazer com a <strong>lista de produtos</strong>?</p>
            <div className="space-y-3 mt-2">
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "manter_precos" ? "border-[hsl(var(--brand))] bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
                onClick={() => setNovaCotacaoOpt("manter_precos")}
              >
                <input type="radio" name="nc" checked={novaCotacaoOpt === "manter_precos"} readOnly className="mt-1 accent-[hsl(var(--brand))]" />
                <div>
                  <div className="text-sm font-bold">Manter itens + importar preços</div>
                  <div className="text-xs text-muted-foreground">Copia os produtos e os preços atuais para a nova cotação.</div>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "manter" ? "border-[hsl(var(--brand))] bg-accent/30" : "border-border hover:border-muted-foreground/30"}`}
                onClick={() => setNovaCotacaoOpt("manter")}
              >
                <input type="radio" name="nc" checked={novaCotacaoOpt === "manter"} readOnly className="mt-1 accent-[hsl(var(--brand))]" />
                <div>
                  <div className="text-sm font-bold">Manter lista de itens</div>
                  <div className="text-xs text-muted-foreground">Apenas limpa os preços. Os produtos permanecem.</div>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "zerar" ? "border-destructive bg-red-50 dark:bg-red-950/30" : "border-border hover:border-muted-foreground/30"}`}
                onClick={() => setNovaCotacaoOpt("zerar")}
              >
                <input type="radio" name="nc" checked={novaCotacaoOpt === "zerar"} readOnly className="mt-1 accent-red-600" />
                <div>
                  <div className="text-sm font-bold">Zerar tudo — lista nova</div>
                  <div className="text-xs text-muted-foreground">Remove todos os produtos e preços. Começa do zero.</div>
                </div>
              </label>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {isZerar ? (
                  <span className="text-amber-800 dark:text-amber-300">
                    <strong>⚠️ Você importou {recentCount} ite{recentCount === 1 ? 'm' : 'ns'} há menos de 7 dias.</strong>
                    <br />Tem certeza que quer zerar tudo?
                  </span>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    <strong>⚠️ Atenção:</strong> {warningItems} ite{warningItems === 1 ? 'm foi importado' : 'ns foram importados'} desta lista.
                    <br />Se continuar, eles ficarão no histórico por 30 dias e poderão ser restaurados depois.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {showWarning ? (
            <>
              <Button variant="outline" onClick={() => setShowWarning(false)}>Cancelar</Button>
              <Button onClick={onConfirm} disabled={loading} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
                Entendi, continuar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={!novaCotacaoOpt || loading} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
                Confirmar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalNovaCotacao;
