import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store } from "lucide-react";

export function LojaSelector() {
  const { lojaAtiva, lojas, setLojaAtivaId } = useLojaAtiva();

  if (lojas.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Store className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
      <Select value={lojaAtiva?.id || ""} onValueChange={setLojaAtivaId}>
        <SelectTrigger className="w-full min-w-0 max-w-[10rem] sm:w-[180px] sm:max-w-none h-8 text-sm">
          <SelectValue placeholder="Selecione a loja" className="truncate" />
        </SelectTrigger>

        <SelectContent>
          {lojas.map((l) => (
            <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
