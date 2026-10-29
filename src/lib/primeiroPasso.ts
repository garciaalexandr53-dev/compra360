export const LINK_EQUIPE_ENVIADO_KEY = "app_funcionarios_link_enviado";

export function marcarLinkEquipeEnviado() {
  try { localStorage.setItem(LINK_EQUIPE_ENVIADO_KEY, "1"); } catch { /* ignore */ }
}

export function linkEquipeEnviado(): boolean {
  try { return localStorage.getItem(LINK_EQUIPE_ENVIADO_KEY) === "1"; } catch { return false; }
}

/** Primeira cotação: já tem fornecedores, nunca fechou cotação e não há faltas da equipe. */
export function ehPrimeiraCotacaoComFornecedores(opts: {
  totalFornecedores: number;
  temCotacaoAnterior: boolean;
  itensFaltantes: number;
}): boolean {
  return opts.totalFornecedores > 0 && !opts.temCotacaoAnterior && opts.itensFaltantes === 0;
}
