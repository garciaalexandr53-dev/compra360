import { formatTimeRemaining } from "./format";

/**
 * Regra de exibição do botão "Fechar compra com quem respondeu":
 * só aparece quando o prazo da cotação já expirou, pelo menos 1 fornecedor
 * respondeu e ainda há pelo menos 1 pendente.
 */
export function podeFecharComQuemRespondeu(
  prazoIso: string | null | undefined,
  respondidos: number,
  pendentes: number,
  nowMs: number = Date.now(),
): boolean {
  if (!prazoIso) return false;
  if (!formatTimeRemaining(prazoIso, nowMs).expired) return false;
  return respondidos > 0 && pendentes > 0;
}
