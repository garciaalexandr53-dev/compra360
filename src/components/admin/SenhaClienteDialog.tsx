import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Copy, Loader2, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  emailAtual: string;
}

export function gerarSenhaForte(): string {
  const letras = "abcdefghijkmnopqrstuvwxyz";
  const maiusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const especiais = "!@#$%&*";
  const todos = letras + maiusculas + numeros + especiais;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = [pick(letras), pick(maiusculas), pick(numeros), pick(especiais)];
  while (base.length < 12) base.push(pick(todos));
  // embaralha
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

export default function SenhaClienteDialog({ open, onOpenChange, userId, emailAtual }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [senha, setSenha] = useState("");
  const [confirmAtual, setConfirmAtual] = useState("");

  useEffect(() => {
    if (open) {
      setSenha("");
      setConfirmAtual("");
    }
  }, [open]);

  const atualOk = confirmAtual.trim().toLowerCase() === (emailAtual || "").toLowerCase();
  const senhaOk = senha.length >= 8;

  const registrarContato = async (observacao: string) => {
    try {
      await supabase.rpc("admin_registrar_contato", {
        _user_id: userId,
        _canal: "email",
        _motivo: "manual",
        _observacao: observacao,
      });
    } catch {
      // histórico é secundário
    }
    queryClient.invalidateQueries({ queryKey: ["admin-contatos-cliente"] });
    queryClient.invalidateQueries({ queryKey: ["admin-cliente-detalhes"] });
  };

  const invoke = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-set-user-password", {
      body: {
        user_id: userId,
        confirm_current_email: confirmAtual.trim().toLowerCase(),
        ...payload,
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const definir = useMutation({
    mutationFn: () => invoke({ action: "set_password", new_password: senha }),
    onSuccess: async () => {
      await registrarContato("Senha temporária definida pelo suporte");
      toast({
        title: "Senha temporária definida",
        description: "Copie a senha agora e passe ao cliente. Ela não será exibida novamente.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Não foi possível definir a senha", description: e.message, variant: "destructive" }),
  });

  const enviarLink = useMutation({
    mutationFn: () =>
      invoke({ action: "send_reset_link", redirect_to: `${window.location.origin}/reset-password` }),
    onSuccess: async () => {
      await registrarContato("Link de redefinição de senha enviado");
      toast({
        title: "Link enviado",
        description: `Enviamos o link de redefinição para ${emailAtual}.`,
      });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Não foi possível enviar o link", description: e.message, variant: "destructive" }),
  });

  const pendente = definir.isPending || enviarLink.isPending;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      toast({ title: "Senha copiada" });
    } catch {
      toast({ title: "Copie manualmente", description: senha });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha do cliente</DialogTitle>
          <DialogDescription>
            Conta: <span className="font-medium break-all">{emailAtual}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <p>Nenhum dado do cliente é apagado — só a senha de acesso muda.</p>
              <p>A senha temporária não é exibida novamente depois de fechar.</p>
              <p>Se o cliente não tem mais acesso ao e-mail, altere o e-mail primeiro.</p>
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="confirma-atual-senha">Digite o e-mail do cliente para confirmar</Label>
            <Input
              id="confirma-atual-senha" type="email" autoComplete="off" value={confirmAtual}
              onChange={(e) => setConfirmAtual(e.target.value)} placeholder={emailAtual}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nova-senha-cliente">Senha temporária (mínimo 8 caracteres)</Label>
            <div className="flex gap-2">
              <Input
                id="nova-senha-cliente" type="text" autoComplete="off" value={senha}
                onChange={(e) => setSenha(e.target.value)} placeholder="Digite ou gere uma senha"
                className="font-mono"
              />
              <Button
                type="button" variant="outline" size="icon" title="Gerar senha forte"
                aria-label="Gerar senha forte" onClick={() => setSenha(gerarSenhaForte())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="outline" size="icon" title="Copiar senha"
                aria-label="Copiar senha" onClick={copiar} disabled={!senha}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {senha.length > 0 && !senhaOk && (
              <p className="text-xs text-destructive">A senha deve ter pelo menos 8 caracteres.</p>
            )}
          </div>

          <Button
            type="button" variant="outline" className="w-full"
            onClick={() => enviarLink.mutate()} disabled={!atualOk || pendente}
          >
            {enviarLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar link de redefinição por e-mail
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendente}>
            Fechar
          </Button>
          <Button onClick={() => definir.mutate()} disabled={!atualOk || !senhaOk || pendente}>
            {definir.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Definir senha temporária
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
