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

/** Mensagem que o Compra360 envia ao fornecedor com o link seguro de atualização. */
export function mensagemLinkParceiro(
  representante: string,
  empresa: string,
  token: string,
  origem = "https://compra360app.com.br",
): string {
  const saudacao = representante.trim() ? `Olá ${representante.trim()}!` : "Olá!";
  const quem = empresa.trim() ? ` da ${empresa.trim()}` : "";
  return `${saudacao} Aqui está o seu link seguro para atualizar os dados${quem} no Compra360: ${linkParceiro(token, origem)}`;
}

/** Link público de autocadastro na Rede de Fornecedores. */
export function linkSejaParceiro(origem = "https://compra360app.com.br"): string {
  return `${origem.replace(/\/$/, "")}/seja-parceiro`;
}

/**
 * Mensagem de WhatsApp adequada ao status de consentimento do fornecedor:
 * convite para pendentes, relacionamento para quem participa e porta aberta
 * para quem recusou.
 */
export function mensagemConsentimento(
  status: string | null | undefined,
  representante: string | null | undefined,
  empresa: string | null | undefined,
  origem = "https://compra360app.com.br",
): string {
  const nome = (representante || "").trim();
  const saudacao = nome ? `Olá ${nome}!` : "Olá!";
  const emp = (empresa || "").trim();
  const quem = emp ? ` da ${emp}` : "";

  if (status === "sim") {
    return (
      `${saudacao} Aqui é o Compra360. Você já faz parte da nossa Rede de Fornecedores ` +
      `e recebe as cotações dos supermercados da sua região.\n\n` +
      `Passando para confirmar se está tudo certo com os seus dados (cidades atendidas, ` +
      `pedido mínimo e prazo de pagamento). Quer que eu envie o seu link de atualização?`
    );
  }

  if (status === "nao") {
    return (
      `${saudacao} Aqui é o Compra360. Respeitamos totalmente a sua decisão de não ` +
      `participar da Rede de Fornecedores por enquanto.\n\n` +
      `Estou passando apenas para deixar o nosso canal aberto com a ${emp || "sua empresa"}. ` +
      `Se um dia quiser voltar a receber cotações de supermercados da região, de forma ` +
      `gratuita, é só me chamar por aqui. Abraço!`
    );
  }

  return (
    `${saudacao} Aqui é o Compra360, a plataforma que os supermercados da sua região usam ` +
    `para fazer cotações de compra.\n\n` +
    `Gostaria de convidar a ${emp || "sua empresa"}${emp ? "" : quem} para a nossa Rede de Fornecedores. ` +
    `Funciona assim:\n\n` +
    `1. O supermercado monta a lista de produtos e envia a cotação.\n` +
    `2. Você recebe um link no WhatsApp e digita os seus preços pelo celular, sem instalar nada.\n` +
    `3. Se você for o melhor preço, o pedido chega direto para você.\n\n` +
    `É 100% gratuito para o fornecedor e você só recebe cotações das cidades que atende.\n\n` +
    `Para participar, é só se cadastrar aqui: ${linkSejaParceiro(origem)}`
  );
}
