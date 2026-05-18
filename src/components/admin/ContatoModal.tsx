import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  MessageCircle, Mail, Copy, AlertTriangle, Clock, UserPlus, TimerReset,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  Cliente, SituacaoCliente, detectarSituacao, getMensagem,
} from "@/lib/adminHelpers";

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

  const handleAbrir = () => {
    if (canal === "whatsapp") {
      window.open(buildWhatsAppUrl(null, mensagemEditada), "_blank");
    } else if (cliente.email) {
      const subject = encodeURIComponent(assuntoEditado);
      const body = encodeURIComponent(mensagemEditada);
      window.location.href = `mailto:${cliente.email}?subject=${subject}&body=${body}`;
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
            <div>
              <label className="text-xs font-medium text-muted-foreground">Assunto</label>
              <input
                type="text"
                value={assuntoEditado}
                onChange={(e) => setAssuntoEditado(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
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
            <p className="text-xs text-muted-foreground">
              Como não temos telefone direto, abriremos o WhatsApp Web com a mensagem pronta para
              colar no contato escolhido.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopiar} className="gap-1.5">
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            onClick={handleAbrir}
            className={canal === "whatsapp"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              : "bg-blue-600 hover:bg-blue-700 text-white gap-1.5"}
          >
            {canal === "whatsapp" ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {canal === "whatsapp" ? "Abrir WhatsApp" : "Abrir Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
