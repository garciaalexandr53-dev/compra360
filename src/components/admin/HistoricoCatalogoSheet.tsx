import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import {
  CatalogoLogRow, classeAcao, diffLog, formatarDataHoraLog, labelAcao, nomeItemLog,
} from "@/lib/catalogoLog";

type Props = {
  row: (CatalogoLogRow & { autor: string }) | null;
  onClose: () => void;
};

export default function HistoricoCatalogoSheet({ row, onClose }: Props) {
  const campos = row ? diffLog(row) : [];

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {row && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="break-words pr-6">{nomeItemLog(row)}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className={classeAcao(row.acao)}>{labelAcao(row.acao)}</Badge>
                  <span>{formatarDataHoraLog(row.alterado_em)}</span>
                  <span>·</span>
                  <span className="break-all">{row.autor}</span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-2">
              {campos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma diferença registrada entre o antes e o depois.
                </p>
              ) : (
                campos.map((c) => (
                  <div key={c.campo} className="rounded-lg border p-3 space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through break-words">{c.antes}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium break-words">{c.depois}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-5 text-[11px] text-muted-foreground">Registro somente leitura.</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
