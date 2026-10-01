import * as XLSX from "xlsx";

/** Campos do Compra360 que podem ser ligados a uma coluna da planilha. */
export type CampoImport =
  | "nome"
  | "quantidade"
  | "embalagem"
  | "fator"
  | "ean"
  | "codigo_interno"
  | "preco"
  | "categoria";

export interface CampoDef {
  key: CampoImport;
  label: string;
  descricao: string;
  obrigatorio?: boolean;
  aliases: string[];
}

/** Ordem de exibição na tela de mapeamento. */
export const CAMPOS_IMPORT: CampoDef[] = [
  {
    key: "nome",
    label: "Produto",
    descricao: "Descrição do item como vem do ERP",
    obrigatorio: true,
    aliases: [
      "produto", "produtos", "nome", "nome do produto", "descricao", "descricao do item",
      "descricao item", "desc", "desc produto", "item", "material", "mercadoria",
      "name", "product", "descricao completa", "descr",
    ],
  },
  {
    key: "quantidade",
    label: "Quantidade",
    descricao: "Quantas embalagens comprar",
    aliases: [
      "quantidade", "qtd", "qtde", "qte", "quant", "qty", "quantity", "qt",
      "qt sugestao", "qtd sugestao", "sugestao", "sugestao de compra", "qtd compra",
      "quantidade a comprar", "pedido", "qtd pedido",
    ],
  },
  {
    key: "embalagem",
    label: "Embalagem",
    descricao: "Sigla: CX, FD, PCT, UNI, KG",
    aliases: [
      "embalagem", "embalagens", "emb", "tipo de embalagem", "tipo embalagem",
      "unidade", "unidade de medida", "un", "und", "uni", "unid", "um", "unit",
      "uom", "medida", "tipo",
    ],
  },
  {
    key: "fator",
    label: "Qtd. por embalagem (fator)",
    descricao: "Unidades dentro da caixa ou fardo",
    aliases: [
      "fator", "fator de conversao", "fator conversao", "fator embalagem",
      "qtd por embalagem", "qtd embalagem", "qt embalagem", "unidades por caixa",
      "un por caixa", "un cx", "qtd cx", "multiplo", "multiplo de venda",
      "conversao", "pack", "qtd pack", "fator multiplicador", "qtde embalagem",
    ],
  },
  {
    key: "ean",
    label: "Código de barras (EAN)",
    descricao: "EAN, GTIN ou código de barras",
    aliases: [
      "ean", "ean13", "ean 13", "gtin", "gtin13", "codigo de barras", "cod barras",
      "codbarras", "cod de barras", "barras", "barcode", "cod ean",
    ],
  },
  {
    key: "codigo_interno",
    label: "Código interno",
    descricao: "Referência do produto no seu ERP",
    aliases: [
      "codigo", "codigo interno", "cod", "cod interno", "cod produto",
      "codigo do produto", "sku", "referencia", "ref", "id produto", "cd produto",
      "cd item", "codigo item",
    ],
  },
  {
    key: "preco",
    label: "Último preço pago",
    descricao: "Preço de referência da última compra",
    aliases: [
      "preco", "preco unitario", "preco de custo", "custo", "custo unitario",
      "valor", "valor unitario", "ultimo preco", "ultimo custo", "preco medio",
      "vl unitario", "vlr unitario",
    ],
  },
  {
    key: "categoria",
    label: "Categoria",
    descricao: "Setor, grupo ou departamento",
    aliases: [
      "categoria", "setor", "grupo", "departamento", "secao", "familia",
      "linha", "classe", "subgrupo",
    ],
  },
];

export type Mapeamento = Partial<Record<CampoImport, number>>;

export interface AbaPlanilha {
  nome: string;
  rows: unknown[][];
}

/** Texto sem acento, minúsculo e sem pontuação — base para comparar cabeçalhos. */
export const normalizarCabecalho = (raw: unknown): string =>
  String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._\-/\\]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Detecta o separador mais provável do CSV pela primeira linha preenchida. */
export const detectarSeparador = (texto: string): string => {
  const linha = texto.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const cands = [";", ",", "\t", "|"];
  let melhor = ";";
  let max = -1;
  for (const c of cands) {
    const n = linha.split(c).length - 1;
    if (n > max) {
      max = n;
      melhor = c;
    }
  }
  return max > 0 ? melhor : ";";
};

/** Decodifica bytes de CSV tentando UTF-8 e caindo para windows-1252 (ERPs antigos). */
export const decodificarTexto = (buffer: ArrayBuffer): string => {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(buffer);
  } catch {
    return utf8;
  }
};

/** CSV com suporte a campos entre aspas e separador informado. */
export const lerCsv = (texto: string, sep?: string): unknown[][] => {
  const separador = sep ?? detectarSeparador(texto);
  const rows: unknown[][] = [];
  let campo = "";
  let linha: string[] = [];
  let dentroAspas = false;
  const limpo = texto.replace(/^\uFEFF/, "");

  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (dentroAspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentroAspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"') {
      dentroAspas = true;
    } else if (ch === separador) {
      linha.push(campo.trim());
      campo = "";
    } else if (ch === "\n") {
      linha.push(campo.trim());
      rows.push(linha);
      linha = [];
      campo = "";
    } else if (ch !== "\r") {
      campo += ch;
    }
  }
  if (campo || linha.length) {
    linha.push(campo.trim());
    rows.push(linha);
  }
  return rows.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
};

/** Lê Excel (todas as abas) ou CSV e devolve as linhas crus. */
export const lerArquivo = async (file: File): Promise<AbaPlanilha[]> => {
  const buffer = await file.arrayBuffer();
  const ehCsv = /\.(csv|txt)$/i.test(file.name);
  if (ehCsv) {
    const texto = decodificarTexto(buffer);
    return [{ nome: file.name, rows: lerCsv(texto) }];
  }
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  return wb.SheetNames.map((nome) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], {
      header: 1,
      blankrows: false,
      defval: "",
    });
    return { nome, rows: rows.filter((r) => r.some((c) => String(c ?? "").trim() !== "")) };
  });
};

const pontuaCabecalho = (row: unknown[]): number => {
  const celulas = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (celulas.length < 2) return -1;
  let pontos = celulas.length;
  for (const c of celulas) {
    const n = normalizarCabecalho(c);
    if (!n) continue;
    if (/^[\d.,/-]+$/.test(c)) pontos -= 2; // números não são cabeçalho
    if (CAMPOS_IMPORT.some((campo) => campo.aliases.includes(n))) pontos += 6;
  }
  return pontos;
};

/** Acha a linha onde a tabela realmente começa (ignora logo/título/datas do ERP). */
export const detectarLinhaCabecalho = (rows: unknown[][]): number => {
  const limite = Math.min(rows.length, 15);
  let melhor = 0;
  let max = -Infinity;
  for (let i = 0; i < limite; i++) {
    const p = pontuaCabecalho(rows[i]);
    if (p > max) {
      max = p;
      melhor = i;
    }
  }
  return melhor;
};

/** Sugere automaticamente qual coluna é cada campo do Compra360. */
export const sugerirMapeamento = (headers: unknown[]): Mapeamento => {
  const normalizados = headers.map(normalizarCabecalho);
  const usados = new Set<number>();
  const map: Mapeamento = {};

  const escolher = (campo: CampoDef, teste: (h: string) => boolean) => {
    if (map[campo.key] !== undefined) return;
    const idx = normalizados.findIndex((h, i) => !usados.has(i) && h && teste(h));
    if (idx >= 0) {
      map[campo.key] = idx;
      usados.add(idx);
    }
  };

  // 1ª passada: nome exato do cabeçalho
  for (const campo of CAMPOS_IMPORT) escolher(campo, (h) => campo.aliases.includes(h));
  // 2ª passada: cabeçalho que contém o alias (ex.: "DESCRICAO_ITEM", "QT_SUGESTAO")
  for (const campo of CAMPOS_IMPORT) {
    escolher(campo, (h) =>
      campo.aliases.some((a) => a.length >= 3 && (h.includes(a) || a.includes(h))),
    );
  }
  return map;
};

/** Número tolerante a formato brasileiro ("1.234,50") e a texto com unidade ("12 un"). */
export const parseNumero = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let t = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Separa sigla e fator de uma mesma célula: "CX 12" → { sigla: "CX", fator: 12 },
 * "FD/6" → { sigla: "FD", fator: 6 }, "UN" → { sigla: "UN", fator: null }.
 */
export const separarEmbalagemFator = (
  raw: unknown,
): { sigla: string; fator: number | null } => {
  const texto = String(raw ?? "").trim();
  if (!texto) return { sigla: "", fator: null };
  const letras = texto.match(/[a-zA-Zçãáéíóúâêô]+/g);
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g);
  const sigla = letras ? letras[0] : "";
  const fator = numeros ? parseNumero(numeros[numeros.length - 1]) : null;
  return { sigla, fator: fator && fator > 1 ? fator : null };
};

export interface LinhaImportada {
  nome: string;
  quantidade: number;
  embalagem: string;
  fator: number | null;
  ean: string | null;
  codigo_interno: string | null;
  preco: number | null;
  categoria: string | null;
  /** Linha dentro do arquivo (1-indexada) para mostrar ao usuário. */
  linha: number;
}

export interface ResultadoMapeamento {
  itens: LinhaImportada[];
  /** Linhas descartadas, sempre com o motivo — nada é ignorado em silêncio. */
  ignoradas: { linha: number; motivo: string }[];
}

const somenteDigitos = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const d = String(raw).replace(/\D/g, "");
  return d.length ? d : null;
};

/** Converte as linhas da planilha em itens do Compra360 usando o mapeamento escolhido. */
export const aplicarMapeamento = (
  rows: unknown[][],
  linhaCabecalho: number,
  map: Mapeamento,
): ResultadoMapeamento => {
  const itens: LinhaImportada[] = [];
  const ignoradas: { linha: number; motivo: string }[] = [];
  const pegar = (row: unknown[], campo: CampoImport) => {
    const idx = map[campo];
    return idx === undefined ? undefined : row[idx];
  };

  for (let i = linhaCabecalho + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const numeroLinha = i + 1;
    const nome = String(pegar(row, "nome") ?? "").trim();
    if (!nome) {
      if (row.some((c) => String(c ?? "").trim() !== "")) {
        ignoradas.push({ linha: numeroLinha, motivo: "Sem nome do produto" });
      }
      continue;
    }

    const emb = separarEmbalagemFator(pegar(row, "embalagem"));
    const fatorColuna = parseNumero(pegar(row, "fator"));
    const quantidade = parseNumero(pegar(row, "quantidade"));

    itens.push({
      nome,
      quantidade: quantidade && quantidade > 0 ? quantidade : 1,
      embalagem: emb.sigla || String(pegar(row, "embalagem") ?? "").trim() || "un",
      fator: fatorColuna && fatorColuna > 1 ? fatorColuna : emb.fator,
      ean: somenteDigitos(pegar(row, "ean")),
      codigo_interno: String(pegar(row, "codigo_interno") ?? "").trim() || null,
      preco: parseNumero(pegar(row, "preco")),
      categoria: String(pegar(row, "categoria") ?? "").trim() || null,
      linha: numeroLinha,
    });
  }

  return { itens, ignoradas };
};

/** Primeiros exemplos reais de uma coluna, para o usuário reconhecer o conteúdo. */
export const exemplosDaColuna = (
  rows: unknown[][],
  linhaCabecalho: number,
  coluna: number,
  limite = 3,
): string[] => {
  const out: string[] = [];
  for (let i = linhaCabecalho + 1; i < rows.length && out.length < limite; i++) {
    const v = String(rows[i]?.[coluna] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
};
