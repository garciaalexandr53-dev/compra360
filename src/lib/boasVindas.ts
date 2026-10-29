/** Nome informado no cadastro (metadados da conta), já limpo. */
export function nomeDoCadastro(metadata: Record<string, unknown> | null | undefined): string {
  const v = metadata?.nome;
  return typeof v === "string" ? v.trim().slice(0, 60) : "";
}

/**
 * O modal "Como podemos te chamar?" só aparece para quem ainda não tem nome
 * no perfil E não informou o nome ao criar a conta (contas antigas).
 */
export function deveAbrirModalNome(opts: {
  precisaNome: boolean;
  isAdmin: boolean;
  nomeCadastro: string;
}): boolean {
  return opts.precisaNome && !opts.isAdmin && !opts.nomeCadastro;
}
