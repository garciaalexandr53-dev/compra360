import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  emailAtual: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AlterarEmailDialog({ open, onOpenChange, userId, emailAtual }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState("");
  const [novoRepetido, setNovoRepetido] = useState("");
  const [confirmAtual, setConfirmAtual] = useState("");
  const [atualizarStripe, setAtualizarStripe] = useState(true);

  useEffect(() => {
    if (open) {
      setNovo("");
      setNovoRepetido("");
      setConfirmAtual("");
      setAtualizarStripe(true);
    }
  }, [open]);

  const novoOk = EMAIL_RE.test(novo.trim().toLowerCase());
  const iguais = novo.trim().toLowerCase() === novoRepetido.trim().toLowerCase();
  const atualOk = confirmAtual.trim().toLowerCase() === (emailAtual || "").toLowerCase();
  const diferenteDoAtual = novo.trim().toLowerCase() !== (emailAtual || "").toLowerCase();
  const podeSalvar = novoOk && iguais && atualOk && diferenteDoAtual;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-change-user-email", {
        body: {
          user_id: userId,
          new_email: novo.trim().toLowerCase(),
          confirm_current_email: confirmAtual.trim().toLowerCase(),
          update_stripe: atualizarStripe,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { new_email: string; stripe_updated: boolean; stripe_error: string | null };
    },
    onSuccess: async (data) => {
      try {
        await supabase.rpc("admin_registrar_contato", {
          _user_id: userId,
          _canal: "email",
          _motivo: "manual",
          _observacao: `E-mail alterado de ${emailAtual} para ${data.new_email}`,
        });
      } catch {
        // registro no histórico é secundário
      }
      toast({
        title: "E-mail alterado",
        description: atualizarStripe && !data.stripe_updated
          ? `Login atualizado para ${data.new_email}. Stripe não atualizado: ${data.stripe_error ?? "motivo desconhecido"}.`
          : `O cliente já pode entrar com ${data.new_email}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cliente-detalhes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cliente-pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-contatos-cliente"] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Não foi possível alterar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar e-mail de acesso</DialogTitle>
          <DialogDescription>
            E-mail atual: <span className="font-medium break-all">{emailAtual}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <p>A senha continua a mesma — só o endereço de login muda.</p>
              <p>O cliente perde o acesso pelo e-mail antigo.</p>
              <p>Nenhum dado do cliente é apagado.</p>
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="novo-email">Novo e-mail</Label>
            <Input
              id="novo-email" type="email" autoComplete="off" value={novo}
              onChange={(e) => setNovo(e.target.value)} placeholder="cliente@empresa.com.br"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="novo-email-2">Repita o novo e-mail</Label>
            <Input
              id="novo-email-2" type="email" autoComplete="off" value={novoRepetido}
              onChange={(e) => setNovoRepetido(e.target.value)} placeholder="cliente@empresa.com.br"
            />
            {novoRepetido.length > 0 && !iguais && (
              <p className="text-xs text-destructive">Os e-mails digitados não são iguais.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirma-atual">Digite o e-mail atual para confirmar</Label>
            <Input
              id="confirma-atual" type="email" autoComplete="off" value={confirmAtual}
              onChange={(e) => setConfirmAtual(e.target.value)} placeholder={emailAtual}
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={atualizarStripe}
              onCheckedChange={(v) => setAtualizarStripe(v === true)}
              className="mt-0.5"
            />
            <span>Atualizar também o e-mail de cobrança no Stripe</span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!podeSalvar || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar e-mail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
