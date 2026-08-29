// Helpers compartilhados pelo Painel Administrativo
import { PLAN_PRICES } from "@/lib/planPrices";


export type Cliente = {
  user_id: string;
  email: string;
  created_at: string;
  loja_principal: string | null;
  cnpj: string | null;
  whatsapp: string | null;
  /** Nome pessoal do responsável (perfil). */
  nome_contato?: string | null;
  total_lojas: number;
  total_produtos: number;
  total_produtos_inativos: number;
  total_fornecedores: number;
  total_cotacoes: number;
  total_pedidos: number;
  plan_name: string;
  plan_status: string;
  trial_end: string | null;
  ultima_cotacao_at: string | null;
};

export type SaudeCliente = {
  status: "ativo" | "risco" | "dormindo" | "novo";
  label: string;
  emoji: string;
  className: string;
};

export function getSaudeCliente(c: Cliente): SaudeCliente {
  const now = Date.now();
  const cadastradoEm = new Date(c.created_at).getTime();
  const diasCadastro = (now - cadastradoEm) / (1000 * 60 * 60 * 24);

  if (diasCadastro < 3) {
    return {
      status: "novo",
      label: "Novo",
      emoji: "⚪",
      className: "bg-muted text-muted-foreground border-border",
    };
  }

  const ultimaCotacao = c.ultima_cotacao_at ? new Date(c.ultima_cotacao_at).getTime() : null;

  if (ultimaCotacao) {
    const diasSemUso = (now - ultimaCotacao) / (1000 * 60 * 60 * 24);
    if (diasSemUso <= 7) {
      return {
        status: "ativo",
        label: "Ativo",
        emoji: "🟢",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      };
    }
    if (diasSemUso > 15) {
      return {
        status: "dormindo",
        label: "Dormindo",
        emoji: "🔴",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    }
    // entre 7 e 15 dias: ainda ativo amarelo claro
    return {
      status: "risco",
      label: "Atenção",
      emoji: "🟡",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }

  // Sem cotação e cadastrado há mais de 7 dias = risco
  if (diasCadastro > 7) {
    return {
      status: "risco",
      label: "Risco",
      emoji: "🟡",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    };
  }

  // Cadastrado há 3-7 dias sem cotação ainda
  return {
    status: "novo",
    label: "Novo",
    emoji: "⚪",
    className: "bg-muted text-muted-foreground border-border",
  };
}

export function getDiasTrialRestantes(trialEnd: string | null): number | null {
  if (!trialEnd) return null;
  const diff = new Date(trialEnd).getTime() - Date.now();
  if (diff < 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getDiasSemUso(c: Cliente): number | null {
  if (!c.ultima_cotacao_at) return null;
  const diff = Date.now() - new Date(c.ultima_cotacao_at).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDiasDesdeCadastro(c: Cliente): number {
  const diff = Date.now() - new Date(c.created_at).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export type SituacaoCliente =
  | "sem_uso_7d"
  | "inativo_15d"
  | "trial_7d"
  | "trial_3d"
  | "boas_vindas";

export function detectarSituacao(c: Cliente): SituacaoCliente {
  const diasTrial = getDiasTrialRestantes(c.trial_end);
  if (c.plan_status === "trialing" && diasTrial !== null) {
    if (diasTrial <= 3) return "trial_3d";
    if (diasTrial <= 7) return "trial_7d";
  }

  const saude = getSaudeCliente(c);
  if (saude.status === "dormindo") return "inativo_15d";
  if (saude.status === "risco") return "sem_uso_7d";
  if (saude.status === "novo") return "boas_vindas";

  return "sem_uso_7d";
}

export type MensagemContato = {
  assunto: string;
  whatsapp: string;
  email: string;
};

export function getMensagem(situacao: SituacaoCliente, c: Cliente): MensagemContato {
  const nome = (c.loja_principal || c.email.split("@")[0]).trim();
  const diasTrial = getDiasTrialRestantes(c.trial_end) ?? 0;

  switch (situacao) {
    case "sem_uso_7d":
      return {
        assunto: "Precisa de ajuda para começar no Compra360?",
        whatsapp: `Olá, ${nome}! 👋 Sou o Alexandre do Compra360. Vi que você cadastrou mas ainda não fez sua primeira cotação. Posso te ajudar a começar? É mais simples do que parece — em 10 minutos você já tem tudo rodando! 🚀`,
        email: `Olá ${nome}, tudo bem?\n\nNotei que você criou sua conta no Compra360 mas ainda não fez sua primeira cotação.\n\nEstou aqui para te ajudar no que precisar.\n\nQue tal marcarmos 15 minutos para eu te mostrar como funciona na prática?\n\nAbraço,\nAlexandre — Compra360`,
      };

    case "inativo_15d":
      return {
        assunto: "Novidades no Compra360 que você precisa ver",
        whatsapp: `Oi ${nome}! Faz um tempo que não te vejo no Compra360 🙂 Tivemos novidades — análise de estratégias com IA e sugestão automática de quantidades. Posso te mostrar?`,
        email: `Olá ${nome},\n\nPercebemos que faz um tempo que você não usa o sistema. Lançamos novidades importantes:\n\n- Análise de 3 estratégias de compra com IA\n- Sugestão automática de quantidades\n- Explicação de cada decisão em linguagem simples\n\nQue tal retomar? Estou disponível para uma demonstração rápida.\n\nAbraço,\nAlexandre — Compra360`,
      };

    case "trial_7d":
      return {
        assunto: "Seu trial do Compra360 expira em 7 dias",
        whatsapp: `Olá ${nome}! Seu período de teste do Compra360 termina em ${diasTrial} dias 🗓️ Espero que esteja gostando! Quer continuar com acesso completo? Me chama que te passo as opções.`,
        email: `Olá ${nome},\n\nSeu período de teste gratuito encerra em ${diasTrial} dias. Para continuar sem interrupção:\n\n- Pro: ${PLAN_PRICES.pro.display}${PLAN_PRICES.pro.note} — IA completa + importação em massa + suporte WhatsApp\n- Business: ${PLAN_PRICES.business.display}${PLAN_PRICES.business.note} (promocional, de ${PLAN_PRICES.business.originalDisplay}) — múltiplas lojas + distribuição inteligente\n\nResponda este email ou me chame no WhatsApp.\n\nAbraço,\nAlexandre — Compra360`,
      };

    case "trial_3d":
      return {
        assunto: `⚠️ Seu acesso expira em ${diasTrial} dias — vamos resolver isso?`,
        whatsapp: `${nome}, seu acesso ao Compra360 expira em ${diasTrial} dias ⚠️ Não quero que você perca o acesso! Me fala o que achou e a gente resolve isso juntos.`,
        email: `Olá ${nome},\n\nSeu trial encerra em ${diasTrial} dias.\n\nPara não perder acesso às suas cotações e histórico, confirme seu plano agora.\n\nEstou disponível hoje para qualquer dúvida.\n\nAbraço,\nAlexandre — Compra360`,
      };

    case "boas_vindas":
      return {
        assunto: "Bem-vindo ao Compra360!",
        whatsapp: `Olá ${nome}! 👋 Bem-vindo ao Compra360! Sou o Alexandre e estou aqui para te ajudar a tirar o máximo proveito da plataforma. Qualquer dúvida no setup, me chama! 🚀`,
        email: `Olá ${nome},\n\nSeja bem-vindo ao Compra360!\n\nEstou aqui para te ajudar a configurar seu primeiro fluxo de cotação. Em 10 minutos a gente deixa tudo pronto.\n\nMe chama no WhatsApp ou responde este email quando puder.\n\nAbraço,\nAlexandre — Compra360`,
      };
  }
}

export const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/15 text-primary border-primary/30",
  business: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

/**
 * Normaliza um número de WhatsApp para abertura de conversa.
 * - Remove todos os caracteres não numéricos
 * - Remove o DDI do Brasil (55) quando presente em números com 12 ou 13 dígitos
 * - Retorna null se o resultado tiver menos de 10 dígitos
 */
export function normalizarWhatsAppCliente(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.length >= 10 ? digits : null;
}

export type MotivoContato = "trial_expirando" | "risco_churn" | "sem_ativacao" | "manual";

export const MOTIVO_LABEL: Record<MotivoContato, string> = {
  trial_expirando: "Trial expirando",
  risco_churn: "Risco de churn",
  sem_ativacao: "Sem ativação",
  manual: "Contato manual",
};

export function situacaoParaMotivo(situacao: SituacaoCliente | null | undefined): MotivoContato {
  switch (situacao) {
    case "trial_3d":
    case "trial_7d":
      return "trial_expirando";
    case "inativo_15d":
      return "risco_churn";
    case "sem_uso_7d":
    case "boas_vindas":
      return "sem_ativacao";
    default:
      return "manual";
  }
}


