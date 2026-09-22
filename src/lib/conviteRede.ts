/** Convite oficial da Rede de Fornecedores Compra360 (voz institucional da plataforma). */

export const LINK_REDE_PARCEIRO = "https://compra360app.com.br/seja-parceiro";

/** Mensagem pronta, na voz oficial do Compra360, para convidar fornecedores para a Rede. */
export function montarConviteRede(nomeFornecedor?: string | null): string {
  const saudacao = nomeFornecedor?.trim()
    ? `Olá, ${nomeFornecedor.trim()}!`
    : "Olá!";

  return [
    `${saudacao} O Compra360 é a plataforma que conecta fornecedores e representantes comerciais a supermercados de todo o país.`,
    "",
    "Queremos convidar sua empresa para fazer parte da nossa *Rede de Fornecedores Parceiros* gratuitamente.",
    "",
    "✅ Receba cotações e pedidos de supermercados da sua região direto no seu WhatsApp",
    "✅ Sem mensalidade, sem comissão e sem taxas",
    "✅ Negociação e fechamento direto com o lojista",
    "",
    "Cadastre-se em menos de 1 minuto e comece a receber cotações:",
    `👉 ${LINK_REDE_PARCEIRO}`,
  ].join("\n");
}
