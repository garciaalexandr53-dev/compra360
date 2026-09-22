/** Convite oficial da Rede de Fornecedores Compra360 (voz institucional da plataforma). */

/**
 * Link usado nos convites. Aponta para /rede, uma página estática com a prévia
 * oficial (título, descrição e imagem) lida pelo WhatsApp, que encaminha
 * automaticamente para /seja-parceiro.
 */
export const LINK_REDE_PARCEIRO = "https://compra360app.com.br/rede";

/**
 * Link do convite. Quando a loja que convida é informada, o fornecedor que se
 * cadastrar por esse link já entra na carteira daquela loja.
 */
export function linkConviteRede(lojaId?: string | null): string {
  return lojaId ? `${LINK_REDE_PARCEIRO}?c=${lojaId}` : LINK_REDE_PARCEIRO;
}

/** Mensagem pronta, na voz oficial do Compra360, para convidar fornecedores para a Rede. */
export function montarConviteRede(nomeFornecedor?: string | null, lojaId?: string | null): string {
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
    `👉 ${linkConviteRede(lojaId)}`,
  ].join("\n");
}
