import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Camera, Loader2, Upload, Check, X, FileText } from "lucide-react";

interface OcrItem {
  produto: string;
  quantidade: number | null;
  preco_unitario: number | null;
  embalagem: string | null;
  selected: boolean;
}

interface OcrFornecedor {
  nome: string | null;
  cnpj: string | null;
  data_nf: string | null;
}

interface ImportNfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const ImportNfModal = ({ open, onOpenChange, onImported }: ImportNfModalProps) => {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [items, setItems] = useState<OcrItem[]>([]);
  const [fornecedor, setFornecedor] = useState<OcrFornecedor | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setOcrLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("ocr-nota-fiscal", {
        body: { image_base64: base64, mode: "importar" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data.result;
      const ocrItems = (result?.itens || result || []).map((it: any) => ({
        ...it,
        selected: true,
      }));
      setItems(ocrItems);
      setFornecedor(result?.fornecedor || null);

      if (!ocrItems.length) {
        toast.warning("Nenhum item encontrado na nota fiscal.");
        return;
      }
      setStep("review");
      toast.success(`${ocrItems.length} itens encontrados na NF`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar nota fiscal");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleItem = (idx: number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  };

  const updateItem = (idx: number, field: keyof OcrItem, value: any) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleImport = async () => {
    const selected = items.filter(it => it.selected);
    if (!selected.length) {
      toast.error("Selecione ao menos um item.");
      return;
    }

    setImporting(true);
    try {
      // Get existing products for matching (paginated, no 1000-row limit)
      const { fetchAllProductsMap } = await import("@/lib/supabaseHelpers");
      const fullMap = await fetchAllProductsMap();
      const existingMap = new Map([...fullMap.entries()].map(([k, v]) => [k, v.id]));

      // Get active cotacao
      const { data: cotacao } = await supabase
        .from("cotacoes")
        .select("id")
        .eq("status", "ativa")
        .limit(1)
        .maybeSingle();

      const newProducts: { nome: string; embalagem: string | null }[] = [];
      const matchedIds: { productId: string; item: OcrItem }[] = [];

      for (const item of selected) {
        const key = (item.produto || "").toLowerCase().trim();
        const existingId = existingMap.get(key);
        if (existingId) {
          matchedIds.push({ productId: existingId, item });
        } else {
          newProducts.push({ nome: item.produto, embalagem: item.embalagem || "un" });
        }
      }

      // Insert new products
      if (newProducts.length) {
        const { data: inserted } = await supabase
          .from("produtos")
          .insert(newProducts.map(p => ({ nome: p.nome, embalagem: p.embalagem, ativo: true })))
          .select("id, nome");

        if (inserted) {
          for (const ins of inserted) {
            const item = selected.find(it => it.produto.toLowerCase().trim() === ins.nome.toLowerCase().trim());
            if (item) matchedIds.push({ productId: ins.id, item });
          }
        }
      }

      // Add to active cotacao if exists
      if (cotacao?.id && matchedIds.length) {
        const { data: existingCps } = await supabase
          .from("cotacao_produtos")
          .select("produto_id")
          .eq("cotacao_id", cotacao.id);
        const existingCpSet = new Set((existingCps || []).map(cp => cp.produto_id));

        const toInsert = matchedIds
          .filter(m => !existingCpSet.has(m.productId))
          .map(m => {
            const nome = m.item.produto?.trim() || "";
            const embalagemRaw = (m.item.embalagem || "").trim().toUpperCase();
            const tipo_embalagem = embalagemRaw || "UNI";
            return {
              cotacao_id: cotacao.id,
              produto_id: m.productId,
              nome,
              tipo_embalagem,
              fator_embalagem: 1,
              quantidade: m.item.quantidade || 1,
            };
          })
          .filter(row => row.nome.length > 0);


        if (toInsert.length) {
          await supabase.from("cotacao_produtos").insert(toInsert as any);
        }
      }

      toast.success(`${matchedIds.length} produtos importados da nota fiscal!`);
      onImported?.();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setItems([]);
    setFornecedor(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Nota Fiscal (OCR)
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Tire uma foto ou envie uma imagem da nota fiscal para extrair os produtos automaticamente."
              : "Revise os itens extraídos e confirme a importação."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {ocrLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processando nota fiscal com IA...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Clique para enviar foto da NF</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou PDF • Máx 10MB</p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {fornecedor?.nome && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium">{fornecedor.nome}</div>
                {fornecedor.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {fornecedor.cnpj}</div>}
                {fornecedor.data_nf && <div className="text-xs text-muted-foreground">Data: {fornecedor.data_nf}</div>}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{items.filter(it => it.selected).length} de {items.length} selecionados</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setItems(items.map(it => ({ ...it, selected: !items.every(i => i.selected) })))}
              >
                {items.every(it => it.selected) ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 space-y-2 transition-colors ${
                      item.selected ? "bg-card" : "bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleItem(i)}
                        className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          item.selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                        }`}
                      >
                        {item.selected && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={item.produto}
                          onChange={(e) => updateItem(i, "produto", e.target.value)}
                          className="h-7 text-sm font-medium"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground">Qtd</label>
                            <Input
                              type="number"
                              value={item.quantidade ?? ""}
                              onChange={(e) => updateItem(i, "quantidade", parseFloat(e.target.value) || null)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground">Preço</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.preco_unitario ?? ""}
                              onChange={(e) => updateItem(i, "preco_unitario", parseFloat(e.target.value) || null)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground">Emb.</label>
                            <Input
                              value={item.embalagem ?? ""}
                              onChange={(e) => updateItem(i, "embalagem", e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                <Camera className="h-4 w-4 mr-1.5" />
                Nova foto
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !items.some(it => it.selected)}
                className="flex-1"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Importar {items.filter(it => it.selected).length} itens
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportNfModal;
