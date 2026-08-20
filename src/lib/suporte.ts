import { buildWhatsAppUrl } from "@/lib/format";

export const SUPORTE_WHATSAPP = "44984483553";

export interface BuildSuporteUrlParams {
  nome?: string | null;
  email?: string | null;
  plano?: string | null;
  loja?: string | null;
}

export function buildSuporteUrl({ nome, email, plano, loja }: BuildSuporteUrlParams): string {
  const linhas = [
    "Olá! Sou usuário do Compra360 e preciso de ajuda.",
    "",
    nome ? `Nome: ${nome}` : undefined,
    email ? `E-mail: ${email}` : undefined,
    loja ? `Loja: ${loja}` : undefined,
    plano ? `Plano: ${plano}` : undefined,
  ].filter(Boolean);

  return buildWhatsAppUrl(SUPORTE_WHATSAPP, linhas.join("\n"));
}
