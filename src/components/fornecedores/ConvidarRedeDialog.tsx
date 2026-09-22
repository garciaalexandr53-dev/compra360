import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Send, Link2 } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppUrl } from "@/lib/format";
import { maskTelefone } from "@/lib/masks";
import { montarConviteRede, LINK_REDE_PARCEIRO } from "@/lib/conviteRede";

interface ConvidarRedeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome opcional para personalizar a saudação. */
  nomeFornecedor?: string | null;
  /** Telefone já conhecido (ex.: fornecedor da lista). */
  telefoneInicial?: string | null;
}

const ConvidarRedeDialog = ({
  open,
  onOpenChange,
  nomeFornecedor,
  telefoneInicial,
}: ConvidarRedeDialogProps) => {
  const [telefone, setTelefone] = useState(telefoneInicial ? maskTelefone(telefoneInicial) : "");
  const mensagem = montarConviteRede(nomeFornecedor);

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const enviar = () => {
    const digitos = telefone.replace(/\D/g, "");
    if (digitos && digitos.length < 10) {
      toast.error("Informe o WhatsApp com DDD ou deixe em branco para escolher o contato.");
      return;
    }
    window.open(buildWhatsAppUrl(digitos || null, mensagem), "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar para a Rede Compra360</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie o convite oficial do Compra360. O fornecedor faz o cadastro gratuito e passa a receber
            cotações da região dele no WhatsApp.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="convite-fone">WhatsApp do fornecedor (opcional)</Label>
            <Input
              id="convite-fone"
              inputMode="numeric"
              placeholder="(44) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para escolher o contato dentro do WhatsApp.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem que será enviada</Label>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-line leading-relaxed">
              {mensagem}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => copiar(mensagem, "Convite")}>
              <Copy className="h-4 w-4 mr-1" /> Copiar mensagem
            </Button>
            <Button variant="outline" size="sm" onClick={() => copiar(LINK_REDE_PARCEIRO, "Link")}>
              <Link2 className="h-4 w-4 mr-1" /> Copiar só o link
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={enviar}>
            <Send className="h-4 w-4 mr-1" /> Abrir no WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvidarRedeDialog;
