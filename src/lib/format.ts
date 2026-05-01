export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR');
}

/**
 * Returns ISO string for today at HH:mm in local time.
 * @param hour 0-23 (default 18)
 * @param minute 0-59 (default 0)
 */
export function defaultPrazoHoje(hour = 18, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Format an ISO datetime as HH:mm in local time */
export function formatHoraLocal(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Convert ISO datetime to local "HH:mm" suitable for an <input type="time"> */
export function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Combine "HH:mm" with today's date and return ISO string */
export function timeInputToTodayIso(value: string): string {
  const [hh, mm] = value.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.toISOString();
}

export interface TimeRemaining {
  expired: boolean;
  totalMinutes: number;
  label: string; // "2h 30min", "45min", "expirado"
}

/** Compute time remaining until an ISO datetime in pt-BR human label */
export function formatTimeRemaining(iso: string | null | undefined, nowMs: number = Date.now()): TimeRemaining {
  if (!iso) return { expired: false, totalMinutes: 0, label: "" };
  const target = new Date(iso).getTime();
  const diffMs = target - nowMs;
  if (diffMs <= 0) return { expired: true, totalMinutes: 0, label: "expirado" };
  const totalMinutes = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  let label: string;
  if (h > 0) label = `${h}h ${m}min`;
  else if (m > 0) label = `${m}min`;
  else label = "menos de 1min";
  return { expired: false, totalMinutes, label };
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const cleanPhone = phone?.replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}
