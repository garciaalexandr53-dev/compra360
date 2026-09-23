import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { formatNomeEmpresa, formatNomePessoa, formatTelefone } from "@/lib/masks";
import { tipoFornecedorLabel, pastasLabel } from "@/lib/adminHelpers";

export interface SugestaoFornecedor {
  id: string;
  nome: string;
  representante: string | null;
  telefone: string | null;
  tipo_fornecedor: string | null;
  pasta: string[] | null;
  pedido_minimo: number | null;
  prazo_pagamento: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sugestoes: SugestaoFornecedor[];
  lojaId: string | null;
  cidadeLabel: string;
  onAdded: () => void;
}

const SugestoesRegiaoDialog = ({ open, onOpenChange, sugestoes, lojaId, cidadeLabel, onAdded }: Props) => {
  const [selecionados, setSelecionados] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelecionados(sugestoes.map((s) => s.id));
  }, [open, sugestoes]);

  const toggle = (id: string) =>
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!lojaId) throw new Error("Selecione uma loja antes de adicionar.");
      const { data, error } = await supabase.rpc("copiar_fornecedores_para_loja", {
        _loja_id: lojaId,
        _fornecedor_ids: selecionados,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (total) => {
      toast.success(`${total} fornecedor${total === 1 ? "" : "es"} adicionado${total === 1 ? "" : "s"}!`);
      onOpenChange(false);
      onAdded();
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível adicionar agora."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Novos fornecedores disponíveis para sua loja
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Encontramos {sugestoes.length} fornecedor{sugestoes.length === 1 ? "" : "es"} disponíve
          {sugestoes.length === 1 ? "l" : "is"} para sua loja em {cidadeLabel}. Selecione os que você quer adicionar.
        </p>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelecionados(sugestoes.map((s) => s.id))}>
            Marcar todos
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelecionados([])}>
            Desmarcar todos
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sugestoes.map((s) => {
            const marcado = selecionados.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  marcado ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <Checkbox checked={marcado} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-tight break-words">{formatNomeEmpresa(s.nome)}</p>
                  <p className="text-[11px] text-muted-foreground break-words">
                    {formatNomePessoa(s.representante || "") || "sem representante"}
                    {s.telefone ? ` · ${formatTelefone(s.telefone)}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.tipo_fornecedor && (
                      <Badge variant="outline" className="text-[10px] py-0">{tipoFornecedorLabel(s.tipo_fornecedor)}</Badge>
                    )}
                    {pastasLabel(s.pasta) && (
                      <span className="text-[10px] text-muted-foreground break-words">{pastasLabel(s.pasta)}</span>
                    )}
                  </div>
                  {(s.pedido_minimo || s.prazo_pagamento) && (
                    <p className="text-[11px] text-muted-foreground">
                      {s.pedido_minimo ? `Pedido mín. ${formatBRL(Number(s.pedido_minimo))}` : ""}
                      {s.pedido_minimo && s.prazo_pagamento ? " · " : ""}
                      {s.prazo_pagamento || ""}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button
            onClick={() => adicionar.mutate()}
            disabled={selecionados.length === 0 || adicionar.isPending}
          >
            {adicionar.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Adicionar {selecionados.length} selecionado{selecionados.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegiaoDialog;
