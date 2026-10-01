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

/** Primeiros exemplos reais (preenchidos e distintos) de uma coluna, varrendo o arquivo todo. */
export const exemplosDaColuna = (
  rows: unknown[][],
  linhaCabecalho: number,
  coluna: number,
  limite = 3,
): string[] => {
  const out: string[] = [];
  for (let i = linhaCabecalho + 1; i < rows.length && out.length < limite; i++) {
    const v = String(rows[i]?.[coluna] ?? "").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
};

/** Letra da coluna no Excel: 0 → A, 25 → Z, 26 → AA. */
export const letraColuna = (i: number): string => {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Sugestão completa: usa o cabeçalho e, se não achar o produto, escolhe a coluna
 * com mais textos descritivos (letras, vários caracteres) como Produto.
 */
export const sugerirMapeamentoCompleto = (rows: unknown[][], linhaCabecalho: number): Mapeamento => {
  const headers = rows[linhaCabecalho] ?? [];
  const map = sugerirMapeamento(headers);
  if (map.nome !== undefined) return map;
  const usados = new Set(Object.values(map));
  const nCols = Math.max(headers.length, ...rows.slice(linhaCabecalho, linhaCabecalho + 30).map((r) => r?.length ?? 0));
  let melhor = -1;
  let melhorPontos = 0;
  const amostra = rows.slice(linhaCabecalho, linhaCabecalho + 50);
  for (let c = 0; c < nCols; c++) {
    if (usados.has(c)) continue;
    let pontos = 0;
    for (const r of amostra) {
      const v = String(r?.[c] ?? "").trim();
      if (v.length >= 6 && /[a-zA-Z]{3,}/.test(v) && !/^\d/.test(v)) pontos++;
    }
    if (pontos > melhorPontos) {
      melhorPontos = pontos;
      melhor = c;
    }
  }
  if (melhor >= 0 && melhorPontos >= 2) map.nome = melhor;
  return map;
};

const celulasPreenchidas = (row: unknown[] | undefined) =>
  (row ?? [])
    .map((v, i) => ({ i, v: String(v ?? "").trim() }))
    .filter((c) => c.v !== "");

const RODAPE_ESPELHO = /subtotal|frete|seguro|desp|i\.?p\.?i|icms|custo diversos|desconto|total|responsavel/i;

/**
 * Espelho de pedido do ERP em 2 linhas por item:
 *   linha A: código | descrição
 *   linha B: quantidade | "x" | preço unitário | total
 * Retorna null quando o arquivo não segue esse formato.
 */
export const detectarEspelhoPedido = (
  rows: unknown[][],
): (ResultadoMapeamento & { fornecedor: string | null }) | null => {
  const itens: LinhaImportada[] = [];
  let fornecedor: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const a = celulasPreenchidas(rows[i]);
    const primeira = a[0]?.v ?? "";
    if (/^fornec/i.test(primeira) && a[1]) {
      fornecedor = a[1].v.replace(/^\d+\s+/, "").trim() || null;
      continue;
    }
    if (a.length !== 2 || !/^\d{3,}$/.test(a[0].v) || !/[a-zA-Z]/.test(a[1].v)) continue;
    if (RODAPE_ESPELHO.test(a[1].v) && a[1].v.length < 25) continue;

    const b = celulasPreenchidas(rows[i + 1]);
    const xIdx = b.findIndex((c) => c.v.toLowerCase() === "x");
    if (xIdx < 1) continue;
    const quantidade = parseNumero(b[0].v);
    if (!quantidade || quantidade <= 0) continue;
    const preco = parseNumero(b[xIdx + 1]?.v);
    const emb = separarEmbalagemFator(b.slice(1, xIdx).map((c) => c.v).join(" "));

    itens.push({
      nome: a[1].v,
      quantidade,
      embalagem: emb.sigla || "un",
      fator: emb.fator,
      ean: null,
      codigo_interno: a[0].v,
      preco,
      categoria: null,
      linha: i + 1,
    });
    i++;
  }

  return itens.length >= 2 ? { itens, ignoradas: [], fornecedor } : null;
};

/* ---------------- Memória do formato da planilha (Parte 3) ---------------- */

const MEMORIA_KEY = "c360-formatos-planilha";

/** Identifica o formato pelos títulos das colunas (ex: "cod|produto|qtd"). */
export const assinaturaCabecalho = (rows: unknown[][], linhaCabecalho: number): string =>
  (rows[linhaCabecalho] ?? []).map((h) => normalizarCabecalho(h)).join("|");

type MemoriaFormatos = Record<string, { mapeamento: Mapeamento; usadoEm: number }>;

const lerMemoria = (escopo: string): MemoriaFormatos => {
  try {
    const all = JSON.parse(localStorage.getItem(MEMORIA_KEY) || "{}");
    return all[escopo] ?? {};
  } catch {
    return {};
  }
};

/** Grava o mapeamento usado para esse formato (escopo = usuário + destino). */
export const lembrarFormato = (
  escopo: string,
  rows: unknown[][],
  linhaCabecalho: number,
  mapeamento: Mapeamento,
) => {
  const assinatura = assinaturaCabecalho(rows, linhaCabecalho);
  if (!assinatura.replace(/\|/g, "")) return;
  try {
    const all = JSON.parse(localStorage.getItem(MEMORIA_KEY) || "{}");
    const atual: MemoriaFormatos = all[escopo] ?? {};
    atual[assinatura] = { mapeamento, usadoEm: Date.now() };
    // mantém só os 20 formatos mais recentes
    const ordenado = Object.entries(atual).sort((a, b) => b[1].usadoEm - a[1].usadoEm).slice(0, 20);
    all[escopo] = Object.fromEntries(ordenado);
    localStorage.setItem(MEMORIA_KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento: segue sem memória */
  }
};

/** Usa o formato lembrado quando o cabeçalho é o mesmo; senão, a sugestão automática. */
export const sugerirComMemoria = (
  escopo: string,
  rows: unknown[][],
  linhaCabecalho: number,
): { mapeamento: Mapeamento; lembrado: boolean } => {
  const salvo = lerMemoria(escopo)[assinaturaCabecalho(rows, linhaCabecalho)];
  const total = Math.max(0, ...rows.map((r) => r?.length ?? 0));
  if (salvo && Object.values(salvo.mapeamento).every((c) => c === undefined || c < total)) {
    return { mapeamento: salvo.mapeamento, lembrado: true };
  }
  return { mapeamento: sugerirMapeamentoCompleto(rows, linhaCabecalho), lembrado: false };
};

/** Mescla formatos vindos da nuvem na cópia local (a nuvem prevalece). */
export const mesclarFormatos = (
  escopo: string,
  formatos: { assinatura: string; mapeamento: Mapeamento; usadoEm: number }[],
) => {
  try {
    const all = JSON.parse(localStorage.getItem(MEMORIA_KEY) || "{}");
    const atual: MemoriaFormatos = all[escopo] ?? {};
    for (const f of formatos) atual[f.assinatura] = { mapeamento: f.mapeamento, usadoEm: f.usadoEm };
    all[escopo] = atual;
    localStorage.setItem(MEMORIA_KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento */
  }
};
