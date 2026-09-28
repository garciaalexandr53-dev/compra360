import { useEffect, useRef, useState } from "react";
import { consultarCNPJ, validarCNPJ, type DadosCNPJ } from "@/lib/cnpj";

export type StatusCNPJ = "vazio" | "incompleto" | "invalido" | "consultando" | "ok" | "inativo" | "nao_encontrado" | "erro";

/**
 * Valida e consulta o CNPJ na Receita. Chama onDados uma vez por CNPJ encontrado
 * (ativo ou não), para a tela preencher seus campos.
 */
export function useConsultaCNPJ(cnpj: string, onDados?: (d: DadosCNPJ) => void) {
  const digitos = cnpj.replace(/\D/g, "");
  const [status, setStatus] = useState<StatusCNPJ>("vazio");
  const [dados, setDados] = useState<DadosCNPJ | null>(null);
  const cb = useRef(onDados);
  cb.current = onDados;
  const ultimo = useRef<string>("");

  useEffect(() => {
    if (!digitos) { setStatus("vazio"); setDados(null); return; }
    if (digitos.length < 14) { setStatus("incompleto"); setDados(null); return; }
    if (!validarCNPJ(digitos)) { setStatus("invalido"); setDados(null); return; }
    let vivo = true;
    setStatus("consultando");
    const t = setTimeout(async () => {
      try {
        const d = await consultarCNPJ(digitos);
        if (!vivo) return;
        if (!d) { setStatus("nao_encontrado"); setDados(null); return; }
        setDados(d);
        setStatus(d.ativa ? "ok" : "inativo");
        if (ultimo.current !== digitos) {
          ultimo.current = digitos;
          cb.current?.(d);
        }
      } catch {
        if (vivo) { setStatus("erro"); setDados(null); }
      }
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [digitos]);

  /** true quando o CNPJ não deve ser salvo (inválido ou situação irregular). */
  const bloqueia = status === "invalido" || status === "inativo";
  return { status, dados, bloqueia };
}
