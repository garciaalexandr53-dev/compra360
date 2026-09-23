/** Máscaras de input pt-BR */

export function maskTelefone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Formata um telefone já salvo para exibição padronizada pt-BR.
 * Aceita qualquer formato de entrada e normaliza para (44) 99944-7117.
 * Remove o prefixo 55 (Brasil) quando presente. Se não for possível
 * identificar um telefone válido, devolve o texto original.
 */
export function formatTelefone(value: string | null | undefined): string {
  if (!value) return "";
  let d = value.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value.trim();
}

/**
 * Padroniza o telefone para gravação: celulares de 10 dígitos recebem o nono
 * dígito (ex.: (44) 9977-6453 -> (44) 99977-6453). Fixos e telefones já
 * completos são apenas formatados. Vazio devolve "".
 */
export function normalizeTelefone(value: string | null | undefined): string {
  if (!value) return "";
  let d = value.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  return formatTelefone(d);
}

export function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Máscara de dinheiro pt-BR: aceita apenas dígitos e formata em centavos.
 * "0200" -> "2,00" · "12345" -> "123,45" · "" -> ""
 */
export function maskMoeda(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  const num = Number(d) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte o texto mascarado em número (0 quando vazio/inválido). */
export function parseMoeda(value: string): number {
  const d = value.replace(/\D/g, "");
  if (!d) return 0;
  return Number(d) / 100;
}

/** Formata um número salvo para o campo mascarado de dinheiro. */
export function moedaParaInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (value === 0) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isTelefoneValido(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return d.length === 0 || d.length === 10 || d.length === 11;
}

export function isCNPJValido(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return d.length === 0 || d.length === 14;
}

const MINUSCULAS_PT = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du", "van", "von", "com", "em", "a", "o",
]);

/** Nome de empresa/fornecedor: sempre em MAIÚSCULO, sem espaços duplicados. */
export function formatNomeEmpresa(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Title Case pt-BR: preposições em minúsculo, siglas curtas preservadas. */
function titleCasePt(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  return words
    .map((word, idx) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (idx > 0 && MINUSCULAS_PT.has(lower)) return lower;
      // trata hifens e barras internas: "cianorte-pr" -> "Cianorte-Pr"
      return lower.replace(/(^|[-/.'])([\p{L}])/gu, (_m, sep: string, ch: string) =>
        sep + ch.toLocaleUpperCase("pt-BR")
      );
    })
    .join(" ");
}

/** Nome de pessoa/representante em Iniciais Maiúsculas. */
export function formatNomePessoa(value: string | null | undefined): string {
  if (!value) return "";
  return titleCasePt(value);
}

/** Nome de loja em Iniciais Maiúsculas, preservando separadores. */
export function formatNomeLoja(value: string | null | undefined): string {
  if (!value) return "";
  return titleCasePt(value);
}
