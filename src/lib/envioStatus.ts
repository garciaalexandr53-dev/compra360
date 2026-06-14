// Single source of truth for "status de envio" by supplier.
// Aligned 1:1 with Postgres enums: envio_status, envio_acao, envio_origem.

export const ENVIO_STATUS = {
  PENDENTE: "pendente",
  ENVIADO: "enviado",
  ENTREGUE: "entregue",
  FALHOU: "falhou",
} as const;
export type EnvioStatus = (typeof ENVIO_STATUS)[keyof typeof ENVIO_STATUS];

export const ENVIO_ACAO = {
  ENVIO_INICIAL: "envio_inicial",
  REENVIO: "reenvio",
  ATUALIZACAO_STATUS: "atualizacao_status",
} as const;
export type EnvioAcao = (typeof ENVIO_ACAO)[keyof typeof ENVIO_ACAO];

export const ENVIO_ORIGEM = {
  MANUAL: "manual",
  AUTOMATICA: "automatica",
} as const;
export type EnvioOrigem = (typeof ENVIO_ORIGEM)[keyof typeof ENVIO_ORIGEM];

interface StatusMeta {
  label: string;
  shortLabel: string;
  dot: string; // background color class for dot
  badge: string; // full badge classes
}

export const statusMeta: Record<EnvioStatus, StatusMeta> = {
  [ENVIO_STATUS.PENDENTE]: {
    label: "Pendente",
    shortLabel: "Pendente",
    dot: "bg-muted-foreground/60",
    badge:
      "bg-muted text-muted-foreground border-border",
  },
  [ENVIO_STATUS.ENVIADO]: {
    label: "Enviado",
    shortLabel: "Enviado",
    dot: "bg-green-500",
    badge:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900",
  },
  [ENVIO_STATUS.ENTREGUE]: {
    label: "Entregue",
    shortLabel: "Entregue",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900",
  },
  [ENVIO_STATUS.FALHOU]: {
    label: "Falhou",
    shortLabel: "Falhou",
    dot: "bg-red-500",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
  },
};

export const acaoLabel: Record<EnvioAcao, string> = {
  [ENVIO_ACAO.ENVIO_INICIAL]: "Envio inicial",
  [ENVIO_ACAO.REENVIO]: "Reenvio",
  [ENVIO_ACAO.ATUALIZACAO_STATUS]: "Atualização de status",
};

export const origemLabel: Record<EnvioOrigem, string> = {
  [ENVIO_ORIGEM.MANUAL]: "Manual",
  [ENVIO_ORIGEM.AUTOMATICA]: "Automática (API)",
};

/** Decide which action to register based on the current persisted status. */
export function acaoParaEnvio(currentStatus: EnvioStatus | null | undefined): EnvioAcao {
  if (!currentStatus || currentStatus === ENVIO_STATUS.PENDENTE) {
    return ENVIO_ACAO.ENVIO_INICIAL;
  }
  return ENVIO_ACAO.REENVIO;
}
