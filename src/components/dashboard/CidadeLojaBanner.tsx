import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatCEP } from "@/components/lojas/lojaUtils";
import EnderecoFields from "@/components/lojas/EnderecoFields";
import { formatNomeLoja } from "@/lib/masks";

/**
 * Aviso exibido no painel quando a loja ativa está sem cidade cadastrada.
 * Permite completar cidade, UF e CEP sem sair do fluxo.
 */
export default function CidadeLojaBanner() {
  const { lojaAtiva } = useLojaAtiva();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");

  const loja = lojaAtiva as {
    id: string;
    nome?: string | null;
    nome_fantasia?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    endereco?: string | null;
    bairro?: string | null;
  } | null | undefined;

  useEffect(() => {
    if (open && loja) {
      setCidade(loja.cidade ?? "");
      setUf((loja.uf ?? "").toUpperCase());
      setCep(formatCEP(loja.cep ?? ""));
      setEndereco(loja.endereco ?? "");
      setBairro(loja.bairro ?? "");
    }
  }, [open, loja?.id]);


  const salvar = useMutation({
    mutationFn: async () => {
      if (!loja?.id) throw new Error("Nenhuma loja selecionada.");
      const { error } = await supabase
        .from("lojas")
        .update({
          cidade: cidade.trim(),
          uf: uf.trim() ? uf.trim().toUpperCase() : null,
          cep: cep.replace(/\D/g, "") ? cep : null,
          endereco: endereco.trim() || null,
          bairro: bairro.trim() || null,
        })
        .eq("id", loja.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da loja atualizados!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["lojas"] });
      qc.invalidateQueries({ queryKey: ["sugestoes-regiao"] });
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar."),
  });

  if (!loja?.id || (loja.cidade && loja.cidade.trim())) return null;

  const nomeLoja = formatNomeLoja(loja.nome_fantasia?.trim() || loja.nome || "sua loja");

  return (
    <>
      <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Complete os dados de {nomeLoja}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Informe a cidade e o estado para receber sugestões de fornecedores que já atendem na sua região.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setOpen(true)}>
            Atualizar dados da loja
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Onde sua loja fica?</DialogTitle>
            <DialogDescription>
              Usamos a cidade para sugerir fornecedores que já atendem na sua região.
            </DialogDescription>
          </DialogHeader>
          <EnderecoFields
            compact
            autoFocusCep
            value={{ cep, endereco, bairro, cidade, uf }}
            onChange={(v) => {
              setCep(v.cep);
              setEndereco(v.endereco);
              setBairro(v.bairro);
              setCidade(v.cidade);
              setUf(v.uf);
            }}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Depois
            </Button>
            <Button
              onClick={() => salvar.mutate()}
              disabled={!cidade.trim() || salvar.isPending}
            >
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
