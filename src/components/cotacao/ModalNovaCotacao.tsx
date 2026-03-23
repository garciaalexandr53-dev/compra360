import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ModalNovaCotacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novaCotacaoOpt: "manter" | "manter_precos" | "zerar" | null;
  setNovaCotacaoOpt: (opt: "manter" | "manter_precos" | "zerar" | null) => void;
  onConfirm: () => void;
  loading?: boolean;
}

const ModalNovaCotacao = ({ open, onOpenChange, novaCotacaoOpt, setNovaCotacaoOpt, onConfirm, loading }: ModalNovaCotacaoProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔄 Nova Cotação</DialogTitle>
        </DialogHeader>
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
            className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${novaCotacaoOpt === "zerar" ? "border-destructive bg-red-50" : "border-border hover:border-muted-foreground/30"}`}
            onClick={() => setNovaCotacaoOpt("zerar")}
          >
            <input type="radio" name="nc" checked={novaCotacaoOpt === "zerar"} readOnly className="mt-1 accent-red-600" />
            <div>
              <div className="text-sm font-bold">Zerar tudo — lista nova</div>
              <div className="text-xs text-muted-foreground">Remove todos os produtos e preços. Começa do zero.</div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!novaCotacaoOpt || loading} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalNovaCotacao;
