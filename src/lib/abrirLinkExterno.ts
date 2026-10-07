/**
 * Abre links externos do fluxo de pagamento (checkout e portal da Stripe).
 *
 * Regra: um pagamento nunca pode ser perdido porque o navegador recusou a nova aba.
 * Em celulares e PWAs instalados, o navegador costuma bloquear a nova aba quando ela
 * é aberta depois da espera da função do servidor. Nesse caso abrimos o link na
 * própria janela — o Stripe devolve o usuário ao painel ao concluir.
 */
export type AberturaDeps = {
  abrir?: (url: string) => Window | null;
  redirecionar?: (url: string) => void;
};

export function abrirLinkExterno(url: string, deps: AberturaDeps = {}): void {
  if (!url) throw new Error("URL não retornada pelo servidor");

  const abrir = deps.abrir ?? ((u: string) => window.open(u, "_blank"));
  const redirecionar =
    deps.redirecionar ??
    ((u: string) => {
      window.location.href = u;
    });

  let novaAba: Window | null = null;
  try {
    novaAba = abrir(url);
  } catch {
    novaAba = null;
  }

  if (novaAba) {
    // Impede que a página aberta manipule esta janela (tab-nabbing).
    try {
      novaAba.opener = null;
    } catch {
      /* alguns navegadores bloqueiam o acesso */
    }
    return;
  }

  redirecionar(url);
}
