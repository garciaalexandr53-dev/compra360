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
}

/**
 * Diálogo unificado de adicionar item.
 * Ordem: Nome → Embalagem → Fator → Quantidade → Total → Botões.
 * Usado por ProdutosPage e AppFuncionariosPublic.
 */
export const AdicionarItemDialog = ({
  produto,
  onConfirmar,
  onCancelar,
  quantidadeInicial = 1,
}: AdicionarItemDialogProps) => {
  const open = !!produto;
  const [embalagem, setEmbalagem] = useState<string>("UNI");
  const [fator, setFator] = useState<string>("1");
  const [qtd, setQtd] = useState<string>(String(quantidadeInicial));

  useEffect(() => {
    if (!produto) return;
    const emb = matchEmbalagem(produto.embalagem);
    const fatorInicial = resolveFatorInicial(emb, produto.fator ?? null);
    setEmbalagem(emb);
    setFator(String(fatorInicial));
    setQtd(String(quantidadeInicial));
  }, [produto, quantidadeInicial]);

  const handleEmbalagemChange = (sigla: string) => {
    setEmbalagem(sigla);
    setFator(String(fatorPadraoDe(sigla)));
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
          <DialogTitle className="text-base font-semibold leading-snug pr-6">
            {produto?.nome}
          </DialogTitle>
          {produto?.subtitulo && (
            <p className="text-xs text-muted-foreground">{produto.subtitulo}</p>
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
                onClick={() => handleEmbalagemChange(emb)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  embalagem === emb
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
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
            onFocus={(e) => e.target.select()}
            onChange={(e) => setFator(e.target.value.replace(/\D/g, ""))}
            onBlur={() => {
              const val = fator.trim();
              if (!val || val === "0") {
                setFator(String(fatorPadraoDe(embalagem)));
              }
            }}
            className="h-10 text-center text-base"
            aria-invalid={fatorInvalido}
          />
          {fatorInvalido && (
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
