import { normalizarTexto, type Municipio } from "@/lib/cep";

/** Chave única de uma cidade atendida (nome normalizado + UF). */
export const chaveCidade = (m: Municipio) =>
  `${normalizarTexto(m.cidade)}|${(m.uf ?? "").toUpperCase()}`;

/** Adiciona a cidade se ela ainda não estiver na lista, mantendo a ordem alfabética. */
export function adicionarCidade(lista: Municipio[], nova: Municipio): Municipio[] {
  const cidade = (nova.cidade ?? "").trim();
  if (!cidade) return lista;
  const item: Municipio = { cidade, uf: (nova.uf ?? "").toUpperCase() };
  const chave = chaveCidade(item);
  if (lista.some((m) => chaveCidade(m) === chave)) return lista;
  return [...lista, item].sort((a, b) =>
    normalizarTexto(a.cidade).localeCompare(normalizarTexto(b.cidade)),
  );
}

/** Remove a cidade indicada da lista. */
export function removerCidade(lista: Municipio[], alvo: Municipio): Municipio[] {
  const chave = chaveCidade(alvo);
  return lista.filter((m) => chaveCidade(m) !== chave);
}

/** Remove duplicidades de uma lista vinda do banco. */
export function dedupCidades(lista: Municipio[]): Municipio[] {
  const vistos = new Set<string>();
  const saida: Municipio[] = [];
  for (const m of lista) {
    const cidade = (m?.cidade ?? "").trim();
    if (!cidade) continue;
    const item: Municipio = { cidade, uf: (m.uf ?? "").toUpperCase() };
    const chave = chaveCidade(item);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(item);
  }
  return saida;
}
