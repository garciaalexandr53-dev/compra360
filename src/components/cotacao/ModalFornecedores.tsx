import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";
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
  /** Optional: enable inline prazo selector. When provided, modal manages prazo before save. */
  prazoIso?: string | null;
  onPrazoChange?: (iso: string | null) => Promise<void> | void;
}

/** Convert ISO -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> in local tz */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function addHoursIsoFromNow(hours: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + hours * 60, 0, 0);
  return d.toISOString();
}

const ModalFornecedores = ({
  open, onOpenChange, fornecedores, selectedSuppliers, onToggle, onSelectAll, onSave,
  prazoIso, onPrazoChange,
}: ModalFornecedoresProps) => {
  const enablePrazo = typeof onPrazoChange === "function";
  const [prazoLocal, setPrazoLocal] = useState<string>(isoToDatetimeLocal(prazoIso));
  const [semPrazo, setSemPrazo] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPrazoLocal(isoToDatetimeLocal(prazoIso));
      setSemPrazo(false);
    }
  }, [open, prazoIso]);


  const handleQuick = (hours: number) => {
    setSemPrazo(false);
    setPrazoLocal(isoToDatetimeLocal(addHoursIsoFromNow(hours)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (enablePrazo) {
        const iso = semPrazo ? null : datetimeLocalToIso(prazoLocal);
        await onPrazoChange!(iso);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = fornecedores.filter(f => selectedSuppliers[f.id] === true).length;

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
        <div className="space-y-2 max-h-[280px] overflow-y-auto mt-2">
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

        {enablePrazo && (
          <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--brand))]" />
              <span className="text-sm font-semibold">⏰ Prazo para resposta</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[4, 8, 24, 48].map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleQuick(h)}
                >
                  +{h}h
                </Button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={prazoLocal}
              disabled={semPrazo}
              onChange={(e) => setPrazoLocal(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
              aria-label="Data e hora limite para resposta"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={semPrazo}
                onChange={(e) => setSemPrazo(e.target.checked)}
                className="accent-[hsl(var(--brand))]"
              />
              Sem prazo definido
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
            Salvar Seleção{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalFornecedores;
