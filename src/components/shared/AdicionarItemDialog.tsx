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
  /** Última compra do item nesta loja — exibida como sugestão (não preenche sozinha). */
  ultimaCompra?: {
    quantidade: number;
    embalagem: string | null;
    fator: number | null;
    pedidoEm: string;
  } | null;
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
  ultimaCompra = null,
}: AdicionarItemDialogProps) => {
  const open = !!produto;
  const [embalagem, setEmbalagem] = useState<string>("UNI");
  const [fator, setFator] = useState<string>("1");
  const [embalagemAberta, setEmbalagemAberta] = useState(false);
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
    setEmbalagemAberta(false);
  }, [produto, quantidadeInicial]);

  const handleEmbalagemChange = (sigla: string) => {
    setEmbalagem(sigla);
    setFator(String(sigla === padrao.embalagem ? padrao.fator : fatorPadraoDe(sigla)));
    setEmbalagemAberta(false);
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
  const ajustado =
    embalagem !== padrao.embalagem || (!fatorInvalido && fatorParsed !== padrao.fator);

  const ultimaEmb = matchEmbalagem(ultimaCompra?.embalagem ?? null);
  const ultimaQtd = ultimaCompra ? Math.max(1, Math.round(ultimaCompra.quantidade)) : 0;
  const ultimaFator =
    ultimaCompra?.fator && ultimaCompra.fator > 0 ? ultimaCompra.fator : fatorPadraoDe(ultimaEmb);
  const ultimaData = ultimaCompra
    ? new Date(ultimaCompra.pedidoEm).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "";

  const usarUltimaCompra = () => {
    if (!ultimaCompra) return;
    setEmbalagem(ultimaEmb);
    setFator(String(ultimaFator));
    setQtd(String(ultimaQtd));
    setEmbalagemAberta(false);
  };




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
        </DialogHeader>

        {ultimaCompra && (
          <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Último pedido:{" "}
              <span className="font-semibold text-foreground">
                {ultimaQtd} {ultimaEmb}
              </span>
              {ultimaFator > 1 && <> ({ultimaQtd * ultimaFator} un)</>}
              {ultimaData && <> · {ultimaData}</>}
            </p>
            <button
              type="button"
              onClick={usarUltimaCompra}
              className="ml-auto text-xs font-semibold text-primary underline underline-offset-2"
            >
              Usar
            </button>
          </div>
        )}



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
                setFator(
                  String(
                    embalagem === padrao.embalagem ? padrao.fator : fatorPadraoDe(embalagem),
                  ),
                );
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
          {ajustado && !fatorInvalido && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Ajustado (padrão do {origemPadrao === "catalogo" ? "catálogo" : "cadastro"}:{" "}
                {padrao.embalagem} {padrao.fator})
              </p>
              <button
                type="button"
                onClick={voltarAoPadrao}
                className="text-[11px] font-medium text-primary underline underline-offset-2"
              >
                Voltar ao padrão
              </button>
            </div>
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
