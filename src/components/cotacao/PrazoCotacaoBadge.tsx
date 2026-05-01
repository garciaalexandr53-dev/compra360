import { useEffect, useState } from "react";
import { Clock, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  formatHoraLocal, formatTimeRemaining, timeInputToTodayIso, toTimeInputValue,
} from "@/lib/format";

interface Props {
  cotacaoId: string;
  prazoIso: string | null | undefined;
  onChange?: () => void;
}

const PrazoCotacaoBadge = ({ cotacaoId, prazoIso, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(prazoIso ? toTimeInputValue(prazoIso) : "18:00");
  const [semPrazo, setSemPrazo] = useState(!prazoIso);
  const [saving, setSaving] = useState(false);
  const [confirmPast, setConfirmPast] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setTime(prazoIso ? toTimeInputValue(prazoIso) : "18:00");
    setSemPrazo(!prazoIso);
  }, [prazoIso]);

  // Re-render every 60s to refresh countdown
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const remaining = formatTimeRemaining(prazoIso);

  const performSave = async (iso: string | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("cotacoes")
      .update({ prazo_resposta: iso } as any)
      .eq("id", cotacaoId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar prazo: " + error.message);
      return;
    }
    toast.success(iso ? `Prazo atualizado para ${formatHoraLocal(iso)}` : "Prazo removido");
    setOpen(false);
    onChange?.();
  };

  const handleSave = () => {
    if (semPrazo) {
      performSave(null);
      return;
    }
    const iso = timeInputToTodayIso(time);
    if (new Date(iso).getTime() < Date.now()) {
      setConfirmPast(iso);
      return;
    }
    performSave(iso);
  };

  const label = prazoIso
    ? remaining.expired
      ? `⏰ ${formatHoraLocal(prazoIso)} · expirado`
      : `⏰ ${formatHoraLocal(prazoIso)} · ${remaining.label}`
    : "♾️ Sem prazo definido";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
              prazoIso && remaining.expired
                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
                : prazoIso
                ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200"
                : "bg-muted border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <span className="truncate max-w-[180px] sm:max-w-none">{label}</span>
            <Pencil className="h-3 w-3 opacity-60 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-1.5rem)] max-w-[280px] sm:w-[280px]"
          align="end"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--brand))]" />
              <span className="text-sm font-semibold">Receber preços até</span>
            </div>
            <input
              type="time"
              value={time}
              disabled={semPrazo}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
                Salvar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={!!confirmPast} onOpenChange={(o) => !o && setConfirmPast(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Horário já passou</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div>
                  Você está definindo o prazo para{" "}
                  <strong className="text-foreground">
                    {confirmPast ? formatHoraLocal(confirmPast) : ""}
                  </strong>
                  , mas agora já são{" "}
                  <strong className="text-foreground">
                    {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                  .
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 space-y-1.5">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">
                    O que vai acontecer:
                  </div>
                  <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-0.5">
                    <li>A cotação aparecerá como <strong>expirada</strong> imediatamente</li>
                    <li>Fornecedores <strong>não poderão enviar preços</strong></li>
                    <li>Você ainda pode reabrir alterando o prazo novamente</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const iso = confirmPast;
                setConfirmPast(null);
                if (iso) performSave(iso);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PrazoCotacaoBadge;
