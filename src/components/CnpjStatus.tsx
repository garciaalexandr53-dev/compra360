import { Loader2 } from "lucide-react";
import type { StatusCNPJ } from "@/hooks/useConsultaCNPJ";
import type { DadosCNPJ } from "@/lib/cnpj";

interface Props {
  status: StatusCNPJ;
  dados: DadosCNPJ | null;
  className?: string;
}

export default function CnpjStatus({ status, dados, className = "" }: Props) {
  const base = `text-xs mt-1 rounded-md ${className}`;
  if (status === "consultando")
    return (
      <p className={`${base} text-muted-foreground flex items-center gap-1`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Consultando Receita...
      </p>
    );
  if (status === "invalido")
    return <p className={`${base} text-destructive`}>CNPJ inválido — confira os números.</p>;
  if (status === "nao_encontrado")
    return <p className={`${base} text-amber-600 dark:text-amber-400`}>CNPJ não encontrado na Receita.</p>;
  if (status === "erro")
    return <p className={`${base} text-muted-foreground`}>Não foi possível consultar a Receita agora. Preencha manualmente.</p>;
  if ((status === "ok" || status === "inativo") && dados) {
    const local = [dados.municipio, dados.uf].filter(Boolean).join("/");
    const ok = status === "ok";
    return (
      <div
        className={`${base} border px-2 py-1.5 ${
          ok
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        }`}
      >
        <p className="font-semibold">{dados.razao_social || "Empresa"}</p>
        <p>
          {local && `${local} · `}Situação: {dados.situacao || "—"}
          {!ok && " — CNPJ com situação irregular na Receita."}
        </p>
      </div>
    );
  }
  return null;
}
