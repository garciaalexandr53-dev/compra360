/** Validação e consulta oficial de CNPJ (Receita Federal via BrasilAPI). */

export interface DadosCNPJ {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: string;
  ativa: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export function validarCNPJ(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = calc(d.slice(0, 12), p1);
  const d2 = calc(d.slice(0, 12) + d1, p2);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

function titulo(v: string): string {
  return v
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\p{L})/gu, (_m, s: string, c: string) => s + c.toLocaleUpperCase("pt-BR"));
}

export function normalizarRespostaCNPJ(j: any, digitos: string): DadosCNPJ {
  const situacao = String(j?.descricao_situacao_cadastral ?? "").trim();
  const logr = [j?.descricao_tipo_de_logradouro, j?.logradouro].filter(Boolean).join(" ").trim();
  return {
    cnpj: digitos,
    razao_social: String(j?.razao_social ?? "").trim(),
    nome_fantasia: String(j?.nome_fantasia ?? "").trim(),
    situacao: situacao ? titulo(situacao) : "",
    ativa: situacao.toUpperCase() === "ATIVA",
    cep: String(j?.cep ?? "").replace(/\D/g, ""),
    logradouro: logr ? titulo(logr) : "",
    numero: String(j?.numero ?? "").trim(),
    bairro: j?.bairro ? titulo(String(j.bairro)) : "",
    municipio: j?.municipio ? titulo(String(j.municipio)) : "",
    uf: String(j?.uf ?? "").toUpperCase(),
  };
}

const cache = new Map<string, DadosCNPJ | null>();

/** Retorna dados, null se não encontrado; lança erro se o serviço falhar. */
export async function consultarCNPJ(value: string): Promise<DadosCNPJ | null> {
  const d = value.replace(/\D/g, "");
  if (cache.has(d)) return cache.get(d)!;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, { signal: ctrl.signal });
    if (r.status === 404 || r.status === 400) {
      cache.set(d, null);
      return null;
    }
    if (!r.ok) throw new Error("indisponivel");
    const dados = normalizarRespostaCNPJ(await r.json(), d);
    cache.set(d, dados);
    return dados;
  } finally {
    clearTimeout(t);
  }
}
