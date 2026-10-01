import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  CAMPOS_IMPORT,
  exemplosDaColuna,
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
  const headers = (rows[linhaCabecalho] ?? []).map((h, i) => {
    const t = String(h ?? "").trim();
    return t || `Coluna ${i + 1}`;
  });

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
  const linhasPreview = rows.slice(linhaCabecalho + 1, linhaCabecalho + 4);

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
            Escolha qual coluna tem o <strong>nome do produto</strong> para continuar. Os outros
            campos são opcionais.
          </p>
        </div>
      )}

      {/* Mobile: um cartão por coluna */}
      <div className="sm:hidden space-y-2">
        {headers.map((h, col) => {
          const campo = campoDaColuna(col);
          return (
            <div key={col} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{h}</span>
                {campo && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {exemplosDaColuna(rows, linhaCabecalho, col).join(" · ") || "sem exemplos"}
              </p>
              <Select value={campo ?? IGNORAR} onValueChange={(v) => definirCampo(col, v)}>
                <SelectTrigger className="h-9 mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IGNORAR}>Ignorar esta coluna</SelectItem>
                  {CAMPOS_IMPORT.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                      {c.obrigatorio ? " *" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Desktop: prévia em tabela com seletor no topo de cada coluna */}
      <div className="hidden sm:block border rounded-lg">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <table className="text-xs">
              <thead>
                <tr className="bg-muted/50">
                  {headers.map((h, col) => (
                    <th key={col} className="p-2 align-top text-left border-r last:border-r-0">
                      <div className="w-44">
                        <p className="font-semibold truncate" title={h}>
                          {h}
                        </p>
                        <Select
                          value={campoDaColuna(col) ?? IGNORAR}
                          onValueChange={(v) => definirCampo(col, v)}
                        >
                          <SelectTrigger className="h-8 mt-1 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORAR}>Ignorar esta coluna</SelectItem>
                            {CAMPOS_IMPORT.map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                                {c.obrigatorio ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasPreview.map((r, i) => (
                  <tr key={i} className="border-t">
                    {headers.map((_, col) => (
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

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
