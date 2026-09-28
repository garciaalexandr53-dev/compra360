/** Ordena A-Z em pt-BR, ignorando acentos e maiúsculas. Não altera o array original. */
export const ordenarPorNome = <T>(itens: T[], getNome: (item: T) => string | null | undefined): T[] =>
  [...itens].sort((a, b) =>
    (getNome(a) || "").localeCompare(getNome(b) || "", "pt-BR", { sensitivity: "base" }),
  );
