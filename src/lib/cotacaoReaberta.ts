export function estadoCotacaoReaberta(cotacao: { reaberta_em?: string | null } | null | undefined) {
  const reaberta = !!cotacao?.reaberta_em;
  return {
    reaberta,
    titulo: reaberta ? "Cotação reaberta para ajustes" : "Todos os fornecedores responderam",
    subtitulo: reaberta
      ? "Adicione itens, inclua fornecedores ou reenvie o link antes de gerar os pedidos novamente."
      : null,
  };
}
