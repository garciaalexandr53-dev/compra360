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
