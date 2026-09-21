/**
 * Busca de cidade/UF a partir do CEP.
 * Usa BrasilAPI (dados IBGE) com fallback para ViaCEP.
 */
export interface CepResultado {
  cep: string;
  cidade: string;
  uf: string;
  bairro?: string;
  logradouro?: string;
}

export const somenteDigitosCep = (valor: string) => valor.replace(/\D/g, "").slice(0, 8);

export const cepCompleto = (valor: string) => somenteDigitosCep(valor).length === 8;

export async function buscarCep(valor: string): Promise<CepResultado | null> {
  const digitos = somenteDigitosCep(valor);
  if (digitos.length !== 8) return null;

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${digitos}`);
    if (r.ok) {
      const d = await r.json();
      if (d?.city) {
        return {
          cep: digitos,
          cidade: String(d.city),
          uf: String(d.state ?? "").toUpperCase(),
          bairro: d.neighborhood ?? undefined,
          logradouro: d.street ?? undefined,
        };
      }
    }
  } catch {
    // segue para o fallback
  }

  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (r.ok) {
      const d = await r.json();
      if (d && !d.erro && d.localidade) {
        return {
          cep: digitos,
          cidade: String(d.localidade),
          uf: String(d.uf ?? "").toUpperCase(),
          bairro: d.bairro ?? undefined,
          logradouro: d.logradouro ?? undefined,
        };
      }
    }
  } catch {
    // sem resultado
  }

  return null;
}

/* ===================== Autocompletar de cidades (IBGE) ===================== */

export interface Municipio {
  cidade: string;
  uf: string;
}

/** Códigos IBGE de UF → sigla (a BrasilAPI devolve só o código numérico). */
const UF_POR_CODIGO: Record<number, string> = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA",
  31: "MG", 32: "ES", 33: "RJ", 35: "SP",
  41: "PR", 42: "SC", 43: "RS",
  50: "MS", 51: "MT", 52: "GO", 53: "DF",
};

let cacheMunicipios: Municipio[] | null = null;
let carregando: Promise<Municipio[]> | null = null;

/** Remove acentos e normaliza para comparação. */
export const normalizarTexto = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Carrega (uma vez) a lista oficial de municípios do IBGE. */
export async function carregarMunicipios(): Promise<Municipio[]> {
  if (cacheMunicipios) return cacheMunicipios;
  if (carregando) return carregando;

  carregando = (async () => {
    try {
      const r = await fetch("https://brasilapi.com.br/api/ibge/municipios/v1");
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d)) {
          cacheMunicipios = d
            .map((m: any) => ({
              cidade: String(m?.nome ?? ""),
              uf: UF_POR_CODIGO[Number(m?.codigo_uf)] ?? "",
            }))
            .filter((m) => m.cidade);
          if (cacheMunicipios.length > 0) return cacheMunicipios;
        }
      }
    } catch {
      // segue para o fallback
    }

    try {
      const r = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
      );
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d)) {
          cacheMunicipios = d
            .map((m: any) => ({
              cidade: String(m?.nome ?? ""),
              uf: String(
                m?.microrregiao?.mesorregiao?.UF?.sigla ??
                  m?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
                  "",
              ).toUpperCase(),
            }))
            .filter((m) => m.cidade);
          return cacheMunicipios;
        }
      }
    } catch {
      // sem resultado
    }

    cacheMunicipios = cacheMunicipios ?? [];
    return cacheMunicipios;
  })();

  const res = await carregando;
  carregando = null;
  return res;
}

/**
 * Sugere municípios a partir do que foi digitado (mínimo 2 caracteres).
 * Prioriza quem começa com o termo, depois quem contém.
 */
export async function buscarMunicipios(termo: string, limite = 8): Promise<Municipio[]> {
  const q = normalizarTexto(termo);
  if (q.length < 2) return [];
  const lista = await carregarMunicipios();
  const comeca: Municipio[] = [];
  const contem: Municipio[] = [];
  for (const m of lista) {
    const n = normalizarTexto(m.cidade);
    if (n.startsWith(q)) comeca.push(m);
    else if (n.includes(q)) contem.push(m);
    if (comeca.length >= limite) break;
  }
  return [...comeca, ...contem].slice(0, limite);
}
