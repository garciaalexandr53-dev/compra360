// Helpers de exportação CSV/Excel para o Painel Administrativo
// Padrão Brasil: UTF-8, separador ";", datas DD/MM/AAAA, vírgula decimal
import * as XLSX from "xlsx";
import { Cliente, getDiasSemUso, getDiasTrialRestantes, getSaudeCliente } from "@/lib/adminHelpers";

const CSV_SEP = ";";

/** Escapa um campo para CSV padrão Brasil (separador ;). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(CSV_SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvLine(cells: unknown[]): string {
  return cells.map(csvEscape).join(CSV_SEP);
}

/** Constrói um CSV completo (UTF-8 puro, sem BOM). */
export function buildCsv(header: string[], rows: unknown[][]): string {
  const lines = [csvLine(header), ...rows.map(csvLine)];
  return lines.join("\r\n");
}

/** Formata ISO em DD/MM/AAAA (vazio se inválido). */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Nome do arquivo com data no formato YYYY-MM-DD. */
export function todayFileSuffix(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  business: "Business",
  pro: "Pro",
};

function planoLabel(plan: string | null | undefined): string {
  if (!plan) return "Free";
  return PLAN_LABEL[plan] ?? plan;
}

function statusLabel(c: Cliente): string {
  if (c.plan_status === "trialing") return "Trial";
  return getSaudeCliente(c).label;
}

/** Linha do CSV de clientes. Exportada para testes. */
export function clienteRow(c: Cliente): unknown[] {
  const trialDias = getDiasTrialRestantes(c.trial_end);
  return [
    c.loja_principal || "",
    c.email || "",
    c.cnpj || "",
    c.whatsapp || "",
    planoLabel(c.plan_name),
    statusLabel(c),
    formatDateBR(c.created_at),
    formatDateBR(c.ultima_cotacao_at),
    c.total_lojas ?? 0,
    c.total_produtos ?? 0,
    c.total_fornecedores ?? 0,
    c.total_cotacoes ?? 0,
    c.total_pedidos ?? 0,
    trialDias !== null ? `${trialDias} dias` : "",
  ];
}

export const CLIENTES_HEADER = [
  "Nome da loja", "Email", "CNPJ", "Telefone", "Plano", "Status",
  "Data de cadastro", "Último acesso", "Lojas", "Produtos",
  "Fornecedores", "Cotações totais", "Pedidos totais", "Trial expira em",
];

export function buildClientesCsv(clientes: Cliente[]): string {
  return buildCsv(CLIENTES_HEADER, clientes.map(clienteRow));
}

export const ALERTAS_HEADER = [
  "Nome da loja", "Email", "Plano", "Status", "Dias", "Telefone",
];

/** Linha de alerta — `tipo` define se "Dias" é dias-sem-uso ou dias-até-expirar. */
export function alertaRow(c: Cliente, tipo: "trial" | "churn"): unknown[] {
  const dias =
    tipo === "trial"
      ? getDiasTrialRestantes(c.trial_end)
      : getDiasSemUso(c);
  const diasLabel =
    tipo === "trial"
      ? dias !== null ? `${dias} dias até expirar` : ""
      : dias !== null ? `${dias} dias sem uso` : "";
  return [
    c.loja_principal || "",
    c.email || "",
    planoLabel(c.plan_name),
    statusLabel(c),
    diasLabel,
    c.whatsapp || "",
  ];
}

export function buildAlertasCsv(clientes: Cliente[], tipo: "trial" | "churn"): string {
  return buildCsv(ALERTAS_HEADER, clientes.map((c) => alertaRow(c, tipo)));
}

/** Dispara o download do CSV no browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function clientesFilename(now: Date = new Date()): string {
  return `clientes_compra360_${todayFileSuffix(now)}.csv`;
}

export function alertasTrialsFilename(now: Date = new Date()): string {
  return `alertas_trials_${todayFileSuffix(now)}.csv`;
}

export function alertasChurnFilename(now: Date = new Date()): string {
  return `alertas_churn_${todayFileSuffix(now)}.csv`;
}
