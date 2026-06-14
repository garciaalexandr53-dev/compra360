import { ENVIO_STATUS, statusMeta, type EnvioStatus } from "@/lib/envioStatus";
import { cn } from "@/lib/utils";

interface Props {
  status: EnvioStatus | null | undefined;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

const StatusEnvioBadge = ({ status, onClick, compact, className }: Props) => {
  const s = (status ?? ENVIO_STATUS.PENDENTE) as EnvioStatus;
  const meta = statusMeta[s];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.badge,
        onClick && "hover:opacity-80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      title={onClick ? `${meta.label} — ver histórico` : meta.label}
      aria-label={meta.label}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {!compact && <span>{meta.label}</span>}
      {compact && <span className="sr-only">{meta.label}</span>}
    </Tag>
  );
};

export default StatusEnvioBadge;
