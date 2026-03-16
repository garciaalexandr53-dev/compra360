import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store } from "lucide-react";

export function LojaSelector() {
  const { lojaAtiva, lojas, setLojaAtivaId } = useLojaAtiva();

  if (lojas.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-muted-foreground" />
      <Select value={lojaAtiva?.id || ""} onValueChange={setLojaAtivaId}>
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue placeholder="Selecione a loja" />
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
