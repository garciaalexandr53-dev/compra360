import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatTimeRemaining, formatHoraLocal } from "@/lib/format";

interface Props {
  prazoIso: string | null | undefined;
  className?: string;
}

/**
 * Inline badge showing countdown until cotacao prazo_resposta.
 * - Green: > 3h restantes
 * - Yellow: <= 3h e > 1h
 * - Red: <= 1h ou expirado
 * - Cinza: sem prazo
 */
export function getPrazoTone(iso: string | null | undefined, nowMs: number = Date.now()):
  "neutral" | "green" | "yellow" | "red" {
  if (!iso) return "neutral";
  const r = formatTimeRemaining(iso, nowMs);
  if (r.expired) return "red";
  if (r.totalMinutes <= 60) return "red";
  if (r.totalMinutes <= 180) return "yellow";
  return "green";
}

const PrazoCountdownBadge = ({ prazoIso, className = "" }: Props) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const tone = getPrazoTone(prazoIso);
  const remaining = formatTimeRemaining(prazoIso);

  const toneClass =
    tone === "red"
      ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
      : tone === "yellow"
      ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200"
      : tone === "green"
      ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-300"
      : "bg-muted border-border text-muted-foreground";

  const label = !prazoIso
    ? "Sem prazo definido"
    : remaining.expired
    ? `Prazo expirado · ${formatHoraLocal(prazoIso)}`
    : `Prazo: hoje ${formatHoraLocal(prazoIso)} · ${remaining.label}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${toneClass} ${className}`}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">⏰ {label}</span>
    </span>
  );
};

export default PrazoCountdownBadge;
