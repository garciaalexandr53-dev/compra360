export type TomDesempenho = "novo" | "positivo" | "atencao" | "neutro";

export interface DesempenhoInfo {
  tom: TomDesempenho;
  texto: string;
  agil: boolean;
}

/** Classifica o engajamento do fornecedor na Rede. "Sem itens" já conta como resposta. */
export function classificarDesempenho(
  total: number | null | undefined,
  respondidas: number | null | undefined,
  tempoHoras: number | null | undefined,
): DesempenhoInfo {
  const t = Math.max(0, Number(total ?? 0));
  const r = Math.min(t, Math.max(0, Number(respondidas ?? 0)));
  const agil = r > 0 && tempoHoras != null && Number(tempoHoras) < 12;
  if (t === 0) return { tom: "novo", texto: "Novo na Rede Compra360", agil: false };
  const cot = `${t} cotaç${t === 1 ? "ão" : "ões"} na região`;
  if (t < 3) return { tom: "positivo", texto: `Participou de ${cot}`, agil };
  const pct = Math.round((r / t) * 100);
  const tom: TomDesempenho = pct >= 80 ? "positivo" : pct >= 50 ? "atencao" : "neutro";
  return { tom, texto: `${pct}% de resposta · ${cot}`, agil };
}
