import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

interface ModalFornecedoresProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedores: Fornecedor[];
  selectedSuppliers: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: (val: boolean) => void;
  onSave: () => void;
}

const ModalFornecedores = ({ open, onOpenChange, fornecedores, selectedSuppliers, onToggle, onSelectAll, onSave }: ModalFornecedoresProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>👥 Fornecedores da Cotação</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Selecione quais fornecedores participam desta cotação. Apenas os selecionados aparecem na tabela e nos cálculos.</p>
        <div className="flex items-center gap-3 mt-2 mb-1">
          <Button variant="outline" size="sm" onClick={() => onSelectAll(true)}>Selecionar todos</Button>
          <Button variant="outline" size="sm" onClick={() => onSelectAll(false)}>Desmarcar todos</Button>
        </div>
        <div className="space-y-2 max-h-[350px] overflow-y-auto mt-2">
          {fornecedores.map((f) => (
            <label
              key={f.id}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedSuppliers[f.id] !== false ? "border-primary/30 bg-primary/5" : "border-border hover:border-muted-foreground/30 opacity-60"}`}
              onClick={() => onToggle(f.id)}
            >
              <Checkbox
                checked={selectedSuppliers[f.id] !== false}
                onCheckedChange={() => onToggle(f.id)}
              />
              <div className="flex-1">
                <div className="text-sm font-bold">{f.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {f.representante && `${f.representante}`}
                  {f.telefone && ` · ${f.telefone}`}
                  {f.pedido_minimo && f.pedido_minimo > 0 ? ` · mín: ${formatBRL(f.pedido_minimo)}` : ""}
                </div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
            Salvar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalFornecedores;
