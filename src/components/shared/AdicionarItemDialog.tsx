import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EMBALAGENS_DIALOG,
  FATOR_PADRAO,
  matchEmbalagem,
  resolveFatorInicial,
} from "@/lib/embalagemFatores";

const fatorPadraoDe = (sigla: string) => FATOR_PADRAO[sigla] ?? 1;

export interface AdicionarItemProduto {
  nome: string;
  embalagem?: string | null;
  fator?: number | null;
  /** Texto opcional exibido como subtítulo (ex: categoria) */
  subtitulo?: string | null;
}

interface AdicionarItemDialogProps {
  produto: AdicionarItemProduto | null;
  onConfirmar: (qtd: number, embalagem: string, fator: number) => void;
  onCancelar: () => void;
  /** Quantidade inicial — padrão 1 */
  quantidadeInicial?: number;
  /**
   * @deprecated Embalagem/fator são sempre editáveis (ajuste vale só para o item).
   * Mantido apenas para compatibilidade de chamadas antigas — não tem efeito.
   */
  locked?: boolean;
  /** Badge opcional ao lado do título (ex.: "Catálogo"). */
  badge?: string | null;
  /** Origem do valor padrão exibido na indicação de ajuste. */
  origemPadrao?: "catalogo" | "cadastro";
}

/**
 * Diálogo unificado de adicionar item.
 * Ordem: Nome → Embalagem → Fator → Quantidade → Total → Botões.
 * Usado por ProdutosPage e AppFuncionariosPublic.
 *
 * Embalagem e fator são SEMPRE editáveis. O valor de origem (catálogo mestre ou
 * cadastro local) entra pré-preenchido como padrão; se o usuário ajustar, o
 * ajuste vale apenas para aquele item (snapshot / itens_faltantes) e nunca
 * altera o catálogo nem o produto local.
 */
export const AdicionarItemDialog = ({
  produto,
  onConfirmar,
  onCancelar,
  quantidadeInicial = 1,
  badge = null,
  origemPadrao = "cadastro",
}: AdicionarItemDialogProps) => {
  const open = !!produto;
  const [embalagem, setEmbalagem] = useState<string>("UNI");
  const [fator, setFator] = useState<string>("1");
  const [qtd, setQtd] = useState<string>(String(quantidadeInicial));
  const [padrao, setPadrao] = useState<{ embalagem: string; fator: number }>({
    embalagem: "UNI",
    fator: 1,
  });

  useEffect(() => {
    if (!produto) return;
    const emb = matchEmbalagem(produto.embalagem);
    const fatorInicial = resolveFatorInicial(emb, produto.fator ?? null);
    setEmbalagem(emb);
    setFator(String(fatorInicial));
    setQtd(String(quantidadeInicial));
    setPadrao({ embalagem: emb, fator: fatorInicial });
  }, [produto, quantidadeInicial]);

  const handleEmbalagemChange = (sigla: string) => {
    setEmbalagem(sigla);
    setFator(String(sigla === padrao.embalagem ? padrao.fator : fatorPadraoDe(sigla)));
  };

  const voltarAoPadrao = () => {
    setEmbalagem(padrao.embalagem);
    setFator(String(padrao.fator));
  };


  const confirmar = () => {
    const qtdNum = parseInt(qtd) || 0;
    if (qtdNum < 1) return;
    const fatorTrimmed = fator.trim();
    const fatorParsed = parseInt(fatorTrimmed);
    // Bloqueia confirmação quando o usuário deixou o fator inválido sem corrigir.
    // O fallback para o padrão acontece via onBlur do campo de fator.
    if (fatorTrimmed === "" || isNaN(fatorParsed) || fatorParsed <= 0) return;
    onConfirmar(qtdNum, embalagem, fatorParsed);
  };

  const fatorTrim = fator.trim();
  const fatorParsed = parseInt(fatorTrim);
  const fatorInvalido = fatorTrim === "" || isNaN(fatorParsed) || fatorParsed <= 0;
  const fatorNum = fatorInvalido ? 1 : fatorParsed;
  const qtdNum = parseInt(qtd) || 0;
  const totalUn = qtdNum * fatorNum;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent
        className="w-[calc(100vw-32px)] max-w-md rounded-2xl p-4 sm:p-6 gap-4"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-snug pr-6 flex items-center gap-2 flex-wrap">
            <span>{produto?.nome}</span>
            {badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {badge}
              </span>
            )}
          </DialogTitle>
          {produto?.subtitulo && (
            <p className="text-xs text-muted-foreground">{produto.subtitulo}</p>
          )}
          {locked && (
            <p className="text-[11px] text-muted-foreground">
              Embalagem e fator definidos pelo catálogo (somente leitura).
            </p>
          )}
        </DialogHeader>

        {/* 2. Embalagem */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Embalagem</label>
          <div className="flex flex-wrap gap-2">
            {EMBALAGENS_DIALOG.map((emb) => (
              <button
                key={emb}
                type="button"
                disabled={locked}
                onClick={() => { if (!locked) handleEmbalagemChange(emb); }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  embalagem === emb
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {emb}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Fator */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Fator (un/embalagem)</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={fator}
            readOnly={locked}
            disabled={locked}
            onFocus={(e) => { if (!locked) e.target.select(); }}
            onChange={(e) => { if (!locked) setFator(e.target.value.replace(/\D/g, "")); }}
            onBlur={() => {
              if (locked) return;
              const val = fator.trim();
              if (!val || val === "0") {
                setFator(String(fatorPadraoDe(embalagem)));
              }
            }}
            className={`h-10 text-center text-base ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-invalid={fatorInvalido}
          />
          {fatorInvalido && !locked && (
            <p role="alert" className="text-xs text-destructive">
              Informe um fator válido (maior que zero)
            </p>
          )}
        </div>


        {/* 4. Quantidade */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quantidade do pedido</label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Ex: 10"
            value={qtd}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
            className="h-14 text-center text-2xl font-bold"
            autoFocus
          />
        </div>

        {/* 5. Total calculado */}
        <p className="text-sm text-center text-muted-foreground">
          {qtdNum > 0 ? (
            fatorNum > 1 ? (
              <>
                <span className="font-semibold text-foreground">{qtdNum} {embalagem}</span>
                {" = "}
                <span className="font-semibold text-foreground">{totalUn} unidades</span>
              </>
            ) : (
              <span className="font-semibold text-foreground">{qtdNum} {embalagem}</span>
            )
          ) : (
            "Informe a quantidade"
          )}
        </p>

        {/* 6. Botões */}
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={onCancelar}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 h-11 bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
            onClick={confirmar}
            disabled={qtdNum < 1 || fatorInvalido}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdicionarItemDialog;
