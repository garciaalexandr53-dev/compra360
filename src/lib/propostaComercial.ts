// Gerador de proposta comercial — regras e cálculos puros (sem UI).

export interface PresetProposta {
  id: string;
  label: string;
  anual: number;
  mensal: number;
  implantacao: number;
}

export const PRESETS_PROPOSTA: PresetProposta[] = [
  { id: "pro", label: "Pro (1-2 lojas)", anual: 1188, mensal: 119, implantacao: 0 },
  { id: "rede5", label: "Rede 3-5 lojas", anual: 2490, mensal: 290, implantacao: 500 },
  { id: "rede10", label: "Rede 6-10 lojas", anual: 3990, mensal: 450, implantacao: 800 },
];

export interface PropostaDados {
  rede: string;
  decisor: string;
  cidade: string;
  whatsDecisor: string;
  lojas: number;
  itensPorCotacao: number;
  cotacoesPorSemana: number;
  presetId: string;
  anual: number;
  mensal: number;
  implantacao: number;
  validadeDias: number;
  pix: string;
  contato: string;
}

export const PROPOSTA_PADRAO: PropostaDados = {
  rede: "",
  decisor: "",
  cidade: "",
  whatsDecisor: "",
  lojas: 3,
  itensPorCotacao: 180,
  cotacoesPorSemana: 2,
  presetId: "rede5",
  anual: 2490,
  mensal: 290,
  implantacao: 500,
  validadeDias: 7,
  pix: "",
  contato: "(44) 98448-3553",
};

/** Economia do anual à vista vs 12 meses do mensal + implantação. */
export function economiaAnual(d: Pick<PropostaDados, "anual" | "mensal" | "implantacao">): number {
  return Math.max(0, Math.round((d.mensal * 12 + d.implantacao - d.anual) * 100) / 100);
}

/** Minutos para fechar uma cotação manualmente (por loja) vs com o Compra360 (todas as lojas). */
export function tempoCotacaoMin(itens: number, lojas: number) {
  const antes = Math.round((60 + itens * 1.5) * Math.max(1, lojas));
  const depois = 45;
  return { antes, depois };
}

/** Horas economizadas por mês (4,3 semanas). */
export function horasEconomizadasMes(d: Pick<PropostaDados, "itensPorCotacao" | "lojas" | "cotacoesPorSemana">): number {
  const { antes, depois } = tempoCotacaoMin(d.itensPorCotacao, d.lojas);
  const min = Math.max(0, antes - depois) * Math.max(0, d.cotacoesPorSemana) * 4.3;
  return Math.round(min / 60);
}

export function dataValidade(base: Date, dias: number): Date {
  const r = new Date(base);
  r.setDate(r.getDate() + dias);
  return r;
}

export function numeroProposta(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (d: Date) => d.toLocaleDateString("pt-BR");

export function mensagemWhatsApp(d: PropostaDados, hoje = new Date()): string {
  const nome = d.decisor.trim().split(" ")[0] || "";
  const eco = economiaAnual(d);
  return [
    `Olá${nome ? ` ${nome}` : ""}! Segue a proposta do Compra360 para ${d.rede || "a sua rede"} (${d.lojas} ${d.lojas === 1 ? "loja" : "lojas"}).`,
    "",
    `• Anual à vista: ${brl(d.anual)} (implantação grátis${eco > 0 ? `, economia de ${brl(eco)}` : ""})`,
    `• Mensal: ${brl(d.mensal)}/mês${d.implantacao > 0 ? ` + ${brl(d.implantacao)} de implantação` : ""}`,
    `• Estimativa: ~${horasEconomizadasMes(d)} horas economizadas por mês`,
    "",
    `Proposta válida até ${dataBR(dataValidade(hoje, d.validadeDias))}. O PDF completo vai em anexo.`,
  ].join("\n");
}

/** Converte "1.500", "1.500,50", "300,5" ou "300.5" em número. Vazio → null. */
export function parseNumeroCampo(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let norm: string;
  if (s.includes(",")) norm = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
  else norm = s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

