import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

type Acao = {
  tipo: "atualizado" | "criado" | "cancelado" | "trial_expirado" | "nao_vinculado" | "erro";
  email: string | null;
  detalhe: string;
};

type Resultado = {
  dry_run: boolean;
  total_stripe: number;
  atualizados: number;
  criados: number;
  cancelados: number;
  trials_expirados: number;
  nao_vinculados: number;
  erros: number;
  acoes: Acao[];
};

const LABELS: Record<Acao["tipo"], string> = {
  atualizado: "Atualizado",
  criado: "Criado",
  cancelado: "Cancelado",
  trial_expirado: "Trial expirado",
  nao_vinculado: "Sem usuário",
  erro: "Erro",
};

export default function ResyncAssinaturasButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [previa, setPrevia] = useState<Resultado | null>(null);

  const chamar = async (dryRun: boolean): Promise<Resultado> => {
    const { data, error } = await supabase.functions.invoke("admin-resync-subscriptions", {
      body: { dry_run: dryRun },
    });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as Resultado;
  };

  const simular = async () => {
    setLoading(true);
    try {
      const res = await chamar(true);
      setPrevia(res);
      setOpen(true);
    } catch (e) {
      toast.error(`Erro ao simular: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    try {
      const res = await chamar(false);
      toast.success(
        `Sincronizado: ${res.atualizados} atualizados, ${res.criados} criados, ${res.cancelados} cancelados, ${res.trials_expirados} trials expirados.`,
      );
      setOpen(false);
      setPrevia(null);
      queryClient.invalidateQueries({ queryKey: ["stripe-dados"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
    } catch (e) {
      toast.error(`Erro ao aplicar: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setAplicando(false);
    }
  };

  const totalMudancas = previa
    ? previa.atualizados + previa.criados + previa.cancelados + previa.trials_expirados
    : 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={simular} disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <RefreshCcw className="h-4 w-4 mr-1" />
        )}
        Re-sincronizar assinaturas
      </Button>

      <Dialog open={open} onOpenChange={(v) => !aplicando && setOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Simulação da sincronização</DialogTitle>
            <DialogDescription>
              Nada foi alterado ainda. Confira o que será ajustado no banco a partir do Stripe.
            </DialogDescription>
          </DialogHeader>

          {previa && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Linha label="Assinaturas no Stripe" valor={previa.total_stripe} />
                <Linha label="Serão atualizadas" valor={previa.atualizados} />
                <Linha label="Serão criadas" valor={previa.criados} />
                <Linha label="Serão canceladas" valor={previa.cancelados} />
                <Linha label="Trials vencidos" valor={previa.trials_expirados} />
                <Linha label="Sem usuário" valor={previa.nao_vinculados} />
                {previa.erros > 0 && <Linha label="Erros" valor={previa.erros} destaque />}
              </div>

              {previa.acoes.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {previa.acoes.map((a, i) => (
                    <div key={i} className="p-2 text-xs flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={a.tipo === "erro" ? "destructive" : "secondary"} className="text-[10px]">
                          {LABELS[a.tipo]}
                        </Badge>
                        <span className="truncate text-muted-foreground">{a.email ?? "—"}</span>
                      </div>
                      <span className="text-muted-foreground break-words">{a.detalhe}</span>
                    </div>
                  ))}
                </div>
              )}

              {totalMudancas === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma divergência encontrada — o banco já está igual ao Stripe.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={aplicando} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={aplicar} disabled={aplicando || totalMudancas === 0} className="w-full sm:w-auto">
              {aplicando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Aplicar sincronização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-semibold ${destaque ? "text-destructive" : ""}`}>{valor}</span>
    </div>
  );
}
