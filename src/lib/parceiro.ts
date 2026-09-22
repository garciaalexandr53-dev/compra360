import { SUPORTE_WHATSAPP } from "@/lib/suporte";

/** Mensagem que o fornecedor envia ao Compra360 para confirmar o cadastro. */
export function mensagemConfirmacaoCadastro(
  representante: string,
  empresa: string,
  codigo: string,
): string {
  const quem = [representante.trim(), empresa.trim()].filter(Boolean).join(" da ");
  return `Olá Compra360! Sou ${quem || "um novo parceiro"}. Confirmo meu cadastro na Rede de Fornecedores. Meu código: ${codigo}`;
}

/** Mensagem que o fornecedor já cadastrado envia para pedir o link de atualização. */
export function mensagemAcessoParceiro(empresa: string, codigo: string): string {
  const quem = empresa.trim() ? ` Sou da ${empresa.trim()}.` : "";
  return `Olá Compra360!${quem} Quero atualizar meus dados de parceiro. Meu código: ${codigo}`;
}

/** Abre a conversa com o WhatsApp do Compra360 com a mensagem pronta. */
export function linkSuporteComMensagem(mensagem: string): string {
  return `https://wa.me/55${SUPORTE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}

/** Link exclusivo de atualização de dados do parceiro. */
export function linkParceiro(token: string, origem = "https://compra360app.com.br"): string {
  return `${origem.replace(/\/$/, "")}/parceiro/${token}`;
}
