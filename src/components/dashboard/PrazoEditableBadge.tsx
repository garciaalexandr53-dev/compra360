import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import PrazoCountdownBadge from "./PrazoCountdownBadge";

interface Props {
  cotacaoId: string;
  prazoIso: string | null | undefined;
}

/** Convert ISO -> value for <input type="datetime-local"> in local time */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Add hours to "now" and return ISO */
export function addHoursIso(hours: number, base: number = Date.now()): string {
  return new Date(base + hours * 60 * 60 * 1000).toISOString();
}

const PrazoEditableBadge = ({ cotacaoId, prazoIso }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string>(
    prazoIso ? isoToDatetimeLocal(prazoIso) : isoToDatetimeLocal(addHoursIso(4)),
  );
  const [saving, setSaving] = useState(false);

  const save = async (iso: string | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("cotacoes")
      .update({ prazo_resposta: iso } as any)
      .eq("id", cotacaoId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar prazo: " + error.message);
      return;
    }
    toast.success(iso ? "Prazo atualizado" : "Prazo removido");
    qc.invalidateQueries({ queryKey: ["cotacao-ativa"] });
    setOpen(false);
  };

  const quick = (h: number) => save(addHoursIso(h));

  return (
    <div className="inline-flex items-center gap-1.5">
      <PrazoCountdownBadge prazoIso={prazoIso} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Editar prazo"
            className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-border bg-background hover:bg-accent transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className="w-[calc(100vw-1.5rem)] max-w-[300px] sm:w-[300px] space-y-3"
        >
          <div className="text-sm font-semibold">Atualizar prazo</div>

          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Adicionar a partir de agora</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 4, 8].map((h) => (
                <Button
                  key={h}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => quick(h)}
                  className="h-8 px-0 text-xs"
                >
                  +{h}h
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Horário personalizado
            </label>
            <input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-full h-9 px-2 rounded-md border bg-background text-sm"
            />
            <Button
              size="sm"
              className="w-full mt-2"
              disabled={saving || !custom}
              onClick={() => save(new Date(custom).toISOString())}
            >
              Salvar
            </Button>
          </div>

          {prazoIso && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => save(null)}
              className="w-full text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remover prazo
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PrazoEditableBadge;
