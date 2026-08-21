/**
 * Helpers puros para o histórico de alterações do Catálogo Mestre (aba admin).
 * Somente leitura: comparação de snapshots e formatação de valores.
 */

export type LogAcao = "INSERT" | "UPDATE" | "DELETE";

export type CatalogoLogRow = {
  id: string;
  catalogo_mestre_id: string | null;
  acao: string;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  alterado_por: string | null;
  alterado_em: string;
};

export type DiffCampo = {
  campo: string;
  label: string;
  antes: string;
  depois: string;
};

/** Campos ignorados na comparação. */
const IGNORAR = new Set(["id"]);

const LABELS: Record<string, string> = {
  nome: "Nome",
  ean: "EAN",
  embalagem: "Embalagem",
  fator_embalagem: "Fator de embalagem",
  ativo: "Ativo",
  categoria: "Categoria",
  created_at: "Criado em",
};

export function labelCampo(campo: string): string {
  return LABELS[campo] || campo.replace(/_/g, " ");
}

/** Formata um valor do snapshot para exibição em pt-BR. */
export function formatarValorLog(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

const normalizarAcao = (acao: string): LogAcao => {
  const a = (acao || "").toUpperCase();
  if (a === "INSERT" || a === "DELETE") return a;
  return "UPDATE";
};

/** Nome do item: dados_depois → dados_antes. */
export function nomeItemLog(row: Pick<CatalogoLogRow, "dados_antes" | "dados_depois">): string {
  const depois = row.dados_depois?.["nome"];
  if (typeof depois === "string" && depois.trim()) return depois;
  const antes = row.dados_antes?.["nome"];
  if (typeof antes === "string" && antes.trim()) return antes;
  return "(sem nome)";
}

/**
 * Lista os campos relevantes de um registro do log.
 * - UPDATE: apenas os campos que mudaram.
 * - INSERT: valores criados.
 * - DELETE: valores removidos.
 */
export function diffLog(row: Pick<CatalogoLogRow, "acao" | "dados_antes" | "dados_depois">): DiffCampo[] {
  const acao = normalizarAcao(row.acao);
  const antes = row.dados_antes || {};
  const depois = row.dados_depois || {};

  if (acao === "INSERT") {
    return Object.keys(depois)
      .filter((k) => !IGNORAR.has(k))
      .map((k) => ({ campo: k, label: labelCampo(k), antes: "—", depois: formatarValorLog(depois[k]) }));
  }

  if (acao === "DELETE") {
    return Object.keys(antes)
      .filter((k) => !IGNORAR.has(k))
      .map((k) => ({ campo: k, label: labelCampo(k), antes: formatarValorLog(antes[k]), depois: "—" }));
  }

  const chaves = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]));
  return chaves
    .filter((k) => !IGNORAR.has(k))
    .filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(depois[k] ?? null))
    .map((k) => ({
      campo: k,
      label: labelCampo(k),
      antes: formatarValorLog(antes[k]),
      depois: formatarValorLog(depois[k]),
    }));
}

/** Rótulo pt-BR da ação. */
export function labelAcao(acao: string): string {
  const a = normalizarAcao(acao);
  if (a === "INSERT") return "Criado";
  if (a === "DELETE") return "Removido";
  return "Editado";
}

/** Classe de cor do badge da ação (tokens semânticos). */
export function classeAcao(acao: string): string {
  const a = normalizarAcao(acao);
  if (a === "INSERT") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (a === "DELETE") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-primary/15 text-primary border-primary/30";
}

/**
 * Resolve o autor da alteração.
 * Ordem: nulo → "Sistema"; usuário logado → "Você"; mapa → e-mail; senão UUID abreviado.
 */
export function resolverAutor(
  alteradoPor: string | null,
  currentUserId: string | null | undefined,
  emailPorUserId: Record<string, string>,
): string {
  if (!alteradoPor) return "Sistema";
  if (currentUserId && alteradoPor === currentUserId) return "Você";
  const email = emailPorUserId[alteradoPor];
  if (email) return email;
  return `${alteradoPor.slice(0, 8)}…`;
}

/** Data/hora no formato brasileiro dd/mm/aaaa HH:mm. */
export function formatarDataHoraLog(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
