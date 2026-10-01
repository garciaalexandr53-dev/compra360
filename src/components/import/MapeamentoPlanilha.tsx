import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  CAMPOS_IMPORT,
  exemplosDaColuna,
  letraColuna,
  type AbaPlanilha,
  type CampoImport,
  type Mapeamento,
} from "@/lib/planilhaImport";

const IGNORAR = "__ignorar__";

interface Props {
  abas: AbaPlanilha[];
  abaIndex: number;
  onAbaChange: (i: number) => void;
  linhaCabecalho: number;
  onLinhaCabecalhoChange: (i: number) => void;
  mapeamento: Mapeamento;
  onMapeamentoChange: (m: Mapeamento) => void;
}

const MapeamentoPlanilha = ({
  abas,
  abaIndex,
  onAbaChange,
  linhaCabecalho,
  onLinhaCabecalhoChange,
  mapeamento,
  onMapeamentoChange,
}: Props) => {
  const aba = abas[abaIndex];
  const rows = aba?.rows ?? [];
  const [mostrarVazias, setMostrarVazias] = useState(false);
  const totalCols = Math.max(0, ...rows.slice(linhaCabecalho).map((r) => r?.length ?? 0));
  const headers = Array.from({ length: totalCols }, (_, i) => {
    const t = String(rows[linhaCabecalho]?.[i] ?? "").trim();
    return t || `Coluna ${i + 1}`;
  });
  const valorNulo = (v: unknown) => {
    const t = String(v ?? "").trim();
    if (t === "" || /^[-–—.]+$/.test(t)) return true;
    return /^(r\$\s*)?[0.,\s]+$/i.test(t) && /0/.test(t);
  };
  const colunaVazia = (col: number) =>
    rows.slice(linhaCabecalho + 1).every((r) => valorNulo(r?.[col]));
  const vazias = headers.map((_, i) => i).filter((i) => colunaVazia(i) && !campoDaColunaRaw(i));
  function campoDaColunaRaw(coluna: number) {
    return Object.values(mapeamento).includes(coluna);
  }
  const colunasVisiveis = headers
    .map((_, i) => i)
    .filter((i) => mostrarVazias || !vazias.includes(i));

  const campoDaColuna = (coluna: number): CampoImport | null => {
    const entrada = (Object.entries(mapeamento) as [CampoImport, number][]).find(
      ([, idx]) => idx === coluna,
    );
    return entrada ? entrada[0] : null;
  };

  const definirCampo = (coluna: number, campo: string) => {
    const novo: Mapeamento = { ...mapeamento };
    // uma coluna só pode ter um campo e um campo só pode ter uma coluna
    for (const [k, idx] of Object.entries(novo) as [CampoImport, number][]) {
      if (idx === coluna) delete novo[k];
    }
    if (campo !== IGNORAR) novo[campo as CampoImport] = coluna;
    onMapeamentoChange(novo);
  };

  const temProduto = mapeamento.nome !== undefined;
  const linhasPreview = rows.slice(linhaCabecalho + 1, linhaCabecalho + 6);
  const rotulo = (k: CampoImport) => {
    const c = CAMPOS_IMPORT.find((x) => x.key === k);
    return c ? `${c.label}${c.obrigatorio ? " *" : ""}` : k;
  };

  return (
    <div className="space-y-3">
      {/* Aba + linha do cabeçalho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {abas.length > 1 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Aba da planilha</label>
            <Select value={String(abaIndex)} onValueChange={(v) => onAbaChange(Number(v))}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {abas.map((a, i) => (
                  <SelectItem key={a.nome} value={String(i)}>
                    {a.nome} ({Math.max(a.rows.length - 1, 0)} linhas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Minha tabela começa na linha
          </label>
          <Select
            value={String(linhaCabecalho)}
            onValueChange={(v) => onLinhaCabecalhoChange(Number(v))}
          >
            <SelectTrigger className="h-9 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rows.slice(0, 15).map((r, i) => (
                <SelectItem key={i} value={String(i)}>
                  Linha {i + 1}:{" "}
                  {r
                    .map((c) => String(c ?? "").trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(" · ")
                    .slice(0, 48) || "(vazia)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!temProduto && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Para avançar, escolha em qual coluna está o <strong>nome do produto</strong> (opção
            "Produto / Descrição *"). Os outros campos são opcionais.
          </p>
        </div>
      )}

      {/* Mobile: um cartão por coluna */}
      <div className="sm:hidden space-y-2">
        {colunasVisiveis.map((col) => {
          const h = headers[col];
          const campo = campoDaColuna(col);
          const exemplos = exemplosDaColuna(rows, linhaCabecalho, col, 5);
          const destacar = !temProduto;
          return (
            <div
              key={col}
              className={`rounded-lg border p-2.5 ${campo ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Coluna {letraColuna(col)}
                </span>
                {campo && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-sm font-semibold break-words mt-0.5">{h}</p>
              {exemplos.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {exemplos.map((e, k) => (
                    <li key={k} className="text-[11px] text-muted-foreground break-words">
                      • {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground italic mt-1">Coluna vazia na planilha</p>
              )}
              <Select value={campo ?? IGNORAR} onValueChange={(v) => definirCampo(col, v)}>
                <SelectTrigger className={`h-9 mt-2 ${!campo && destacar ? "border-amber-400" : ""}`}>
                  <SelectValue placeholder="— Selecione o campo —">
                    {campo ? rotulo(campo) : "— O que é esta coluna? —"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS_IMPORT.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                      {c.obrigatorio ? " *" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={IGNORAR}>(Não importar esta coluna)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Desktop: prévia em tabela com seletor no topo de cada coluna */}
      <div className="hidden sm:block border rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="min-w-max">
            <table className="text-xs">
              <thead>
                <tr className="bg-muted/50">
                  {colunasVisiveis.map((col) => { const h = headers[col]; return (
                    <th key={col} className="p-2 align-top text-left border-r last:border-r-0">
                      <div className="w-44">
                        <p className="text-[10px] font-bold uppercase text-primary">
                          Coluna {letraColuna(col)}
                        </p>
                        <p className="font-semibold truncate" title={h}>
                          {h}
                        </p>
                        <Select
                          value={campoDaColuna(col) ?? IGNORAR}
                          onValueChange={(v) => definirCampo(col, v)}
                        >
                          <SelectTrigger className="h-8 mt-1 text-xs">
                            <SelectValue>
                              {campoDaColuna(col)
                                ? rotulo(campoDaColuna(col)!)
                                : "— O que é esta coluna? —"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {CAMPOS_IMPORT.map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                                {c.obrigatorio ? " *" : ""}
                              </SelectItem>
                            ))}
                            <SelectItem value={IGNORAR}>(Não importar esta coluna)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </th>
                  ); })}
                </tr>
              </thead>
              <tbody>
                {linhasPreview.map((r, i) => (
                  <tr key={i} className="border-t">
                    {colunasVisiveis.map((col) => (
                      <td
                        key={col}
                        className="p-2 border-r last:border-r-0 text-muted-foreground max-w-44 truncate"
                      >
                        {String(r?.[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {vazias.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {mostrarVazias
            ? `Mostrando ${vazias.length} coluna(s) vazia(s) da planilha.`
            : `Ocultamos ${vazias.length} coluna(s) vazia(s) da planilha.`}{" "}
          <button type="button" className="text-primary underline" onClick={() => setMostrarVazias((v) => !v)}>
            {mostrarVazias ? "Ocultar" : "Mostrar todas"}
          </button>
        </p>
      )}

      {/* Campos reconhecidos */}
      <div className="flex flex-wrap gap-1.5">
        {CAMPOS_IMPORT.map((c) => {
          const ok = mapeamento[c.key] !== undefined;
          return (
            <span
              key={c.key}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                ok
                  ? "bg-primary/10 text-primary"
                  : c.obrigatorio
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {c.label}
              {ok ? " ✓" : c.obrigatorio ? " *" : ""}
            </span>
          );
        })}
      </div>

      {headers.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onMapeamentoChange({})}
        >
          Limpar mapeamento
        </Button>
      )}
    </div>
  );
};

export default MapeamentoPlanilha;
