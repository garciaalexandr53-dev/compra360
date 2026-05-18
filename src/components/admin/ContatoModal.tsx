import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  MessageCircle, Mail, Copy, AlertTriangle, Clock, UserPlus, TimerReset, Send,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  Cliente, SituacaoCliente, detectarSituacao, getMensagem,
} from "@/lib/adminHelpers";

const emailSchema = z.string().trim().email("E-mail inválido").max(255);

type Canal = "whatsapp" | "email";

interface Props {
  cliente: Cliente | null;
  initialCanal?: Canal;
  /** Força uma situação específica (ex.: aba Alertas). Se omitido, detecta automaticamente. */
  forcarSituacao?: SituacaoCliente;
  onClose: () => void;
}

const SITUACAO_INFO: Record<SituacaoCliente, { label: string; icon: React.ReactNode; color: string }> = {
  sem_uso_7d: {
    label: "Cadastrado mas sem primeira cotação",
    icon: <UserPlus className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
  },
  inativo_15d: {
    label: "Inativo há mais de 15 dias",
    icon: <Clock className="h-4 w-4" />,
    color: "text-destructive",
  },
  trial_7d: {
    label: "Trial expira em até 7 dias",
    icon: <TimerReset className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
  },
  trial_3d: {
    label: "Trial expira em até 3 dias — urgente",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-destructive",
  },
  boas_vindas: {
    label: "Cliente novo — boas-vindas",
    icon: <UserPlus className="h-4 w-4" />,
    color: "text-primary",
  },
};

export default function ContatoModal({ cliente, initialCanal = "whatsapp", forcarSituacao, onClose }: Props) {
  const [canal, setCanal] = useState<Canal>(initialCanal);
  const [enviando, setEnviando] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState("");
  const [assuntoEditado, setAssuntoEditado] = useState("");

  const situacao = useMemo<SituacaoCliente | null>(() => {
    if (!cliente) return null;
    return forcarSituacao ?? detectarSituacao(cliente);
  }, [cliente, forcarSituacao]);

  const mensagem = useMemo(() => {
    if (!cliente || !situacao) return null;
    return getMensagem(situacao, cliente);
  }, [cliente, situacao]);

  // Reseta conteúdo ao abrir/trocar canal
  useEffect(() => {
    if (mensagem) {
      setMensagemEditada(canal === "whatsapp" ? mensagem.whatsapp : mensagem.email);
      setAssuntoEditado(mensagem.assunto);
    }
  }, [mensagem, canal]);

  // Reseta canal ao abrir
  useEffect(() => {
    if (cliente) setCanal(initialCanal);
  }, [cliente, initialCanal]);

  if (!cliente || !situacao || !mensagem) return null;

  const info = SITUACAO_INFO[situacao];

  const handleCopiar = async () => {
    try {
      const texto = canal === "email"
        ? `Assunto: ${assuntoEditado}\n\n${mensagemEditada}`
        : mensagemEditada;
      await navigator.clipboard.writeText(texto);
      toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const emailValidation = useMemo(() => emailSchema.safeParse(cliente?.email ?? ""), [cliente?.email]);
  const emailDestinatario = emailValidation.success ? emailValidation.data : null;
  const whatsappCliente = useMemo(() => {
    // Normaliza: remove espaços, parênteses, hífens, '+' e qualquer caractere não numérico
    let raw = (cliente?.whatsapp ?? "").replace(/\D/g, "");
    // Remove DDI do Brasil (55) quando presente em números com 12 ou 13 dígitos
    if ((raw.length === 12 || raw.length === 13) && raw.startsWith("55")) {
      raw = raw.slice(2);
    }
    return raw.length >= 10 ? raw : null;
  }, [cliente?.whatsapp]);

  const handleAbrir = async () => {
    if (canal === "whatsapp") {
      if (!whatsappCliente) {
        toast({
          title: "WhatsApp do cliente inválido",
          description: "O cliente não tem um número de WhatsApp válido cadastrado (mínimo 10 dígitos). Atualize o cadastro para abrir a conversa direta.",
          variant: "destructive",
        });
        return;
      }
      window.open(buildWhatsAppUrl(whatsappCliente, mensagemEditada), "_blank");
      return;
    }
    if (!emailDestinatario) {
      toast({
        title: "E-mail do cliente inválido",
        description: "Não é possível enviar — verifique o cadastro do cliente.",
        variant: "destructive",
      });
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notification",
          recipientEmail: emailDestinatario,
          idempotencyKey: `admin-contato-${cliente.user_id}-${situacao}-${Date.now()}`,
          templateData: {
            titulo: assuntoEditado,
            mensagem: mensagemEditada,
          },
        },
      });
      if (error) throw error;
      toast({
        title: "Email enviado!",
        description: `Mensagem enviada para ${emailDestinatario} a partir do Compra360.`,
      });
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao enviar email",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={!!cliente} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contatar {cliente.loja_principal || cliente.email}</DialogTitle>
          <DialogDescription className={`flex items-center gap-2 ${info.color}`}>
            {info.icon}
            {info.label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Tabs value={canal} onValueChange={(v) => setCanal(v as Canal)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="whatsapp" className="gap-1.5">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1.5" disabled={!cliente.email}>
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {canal === "email" && (
            <>
              <div className={`rounded-md border p-2.5 text-xs flex items-start gap-2 ${
                emailDestinatario
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}>
                <Send className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">
                    {emailDestinatario ? "Será enviado para:" : "E-mail do cliente inválido"}
                  </div>
                  <div className="truncate font-mono">
                    {emailDestinatario ?? (cliente.email || "— sem e-mail cadastrado —")}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assunto</label>
                <input
                  type="text"
                  value={assuntoEditado}
                  onChange={(e) => setAssuntoEditado(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {canal === "email" ? "Mensagem do email" : "Mensagem do WhatsApp"}
            </label>
            <Textarea
              value={mensagemEditada}
              onChange={(e) => setMensagemEditada(e.target.value)}
              rows={canal === "email" ? 9 : 6}
              className="mt-1"
            />
          </div>

          {canal === "whatsapp" && (
            <div className={`rounded-md border p-2.5 text-xs flex items-start gap-2 ${
              whatsappCliente
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}>
              <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="min-w-0">
                {whatsappCliente ? (
                  <>
                    <div className="font-medium">Abrir conversa direta com:</div>
                    <div className="font-mono">+55 {whatsappCliente}</div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">WhatsApp do cliente inválido</div>
                    <div>Não é possível abrir a conversa — o cliente não tem um número válido cadastrado (mínimo 10 dígitos).</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopiar} className="gap-1.5">
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            onClick={handleAbrir}
            disabled={enviando || (canal === "email" && !emailDestinatario) || (canal === "whatsapp" && !whatsappCliente)}
            className={canal === "whatsapp"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              : "bg-blue-600 hover:bg-blue-700 text-white gap-1.5"}
          >
            {canal === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {canal === "whatsapp"
              ? "Abrir WhatsApp"
              : enviando ? "Enviando..." : "Enviar Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
