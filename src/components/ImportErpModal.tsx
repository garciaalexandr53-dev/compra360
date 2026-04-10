import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Trash2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedItem {
  nome: string;
  quantidade: number;
  embalagem: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string;
}

const ImportErpModal = ({ open, onOpenChange, cotacaoId }: Props) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const detectColumns = (headers: string[]) => {
    const lower = headers.map((h) => (h || "").toString().toLowerCase().trim());
    const nomeIdx = lower.findIndex((h) =>
      ["produto", "nome", "descrição", "descricao", "item", "material", "name", "product"].includes(h)
    );
    const qtdIdx = lower.findIndex((h) =>
      ["quantidade", "qtd", "qtde", "qty", "quant", "quantity"].includes(h)
    );
    const embIdx = lower.findIndex((h) =>
      ["embalagem", "unidade", "un", "unit", "emb", "und", "uom"].includes(h)
    );
    return { nomeIdx: nomeIdx >= 0 ? nomeIdx : 0, qtdIdx, embIdx };
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { toast.error("Arquivo vazio ou sem dados"); return; }

        const sep = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(sep).map((h) => h.replace(/"/g, "").trim());
        const { nomeIdx, qtdIdx, embIdx } = detectColumns(headers);

        const parsed: ParsedItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
          const nome = cols[nomeIdx]?.trim();
          if (!nome) continue;
          parsed.push({
            nome,
            quantidade: qtdIdx >= 0 ? parseFloat(cols[qtdIdx]?.replace(",", ".")) || 1 : 1,
            embalagem: embIdx >= 0 ? cols[embIdx] || "un" : "un",
          });
        }
        setItems(parsed);
        if (parsed.length) toast.success(`${parsed.length} itens detectados`);
        else toast.error("Nenhum item encontrado no arquivo");
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { toast.error("Planilha vazia"); return; }

        const headers = rows[0].map((h: any) => String(h || ""));
        const { nomeIdx, qtdIdx, embIdx } = detectColumns(headers);

        const parsed: ParsedItem[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const nome = String(row[nomeIdx] || "").trim();
          if (!nome) continue;
          parsed.push({
            nome,
            quantidade: qtdIdx >= 0 ? parseFloat(String(row[qtdIdx] || "1").replace(",", ".")) || 1 : 1,
            embalagem: embIdx >= 0 ? String(row[embIdx] || "un").trim() : "un",
          });
        }
        setItems(parsed);
        if (parsed.length) toast.success(`${parsed.length} itens detectados`);
        else toast.error("Nenhum item encontrado na planilha");
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const doImport = async () => {
    if (!items.length) return;
    setImporting(true);
    try {
      // 1. Ensure products exist in banco de produtos (paginated, no 1000-row limit)
      const { fetchAllProductsMap } = await import("@/lib/supabaseHelpers");
      const existingMap = await fetchAllProductsMap();
      const newProducts = items.filter((i) => !existingMap.has(i.nome.toLowerCase().trim()));

      const newProductInserts: { id: string; nome: string; embalagem: string; fator_embalagem: number }[] = [];
      if (newProducts.length) {
        const { data: inserted } = await supabase
          .from("produtos")
          .insert(newProducts.map((p) => ({ nome: p.nome, embalagem: p.embalagem, ativo: true })))
          .select("id, nome, embalagem, fator_embalagem");
        (inserted || []).forEach((p) => {
          existingMap.set(p.nome.toLowerCase().trim(), p);
          newProductInserts.push({ id: p.id, nome: p.nome, embalagem: p.embalagem || "UNI", fator_embalagem: p.fator_embalagem || 1 });
        });
      }

      // 2. Check which products are already in the cotação
      const { data: existingCps } = await supabase
        .from("cotacao_produtos")
        .select("produto_id, id")
        .eq("cotacao_id", cotacaoId);
      const existingProdIds = new Set((existingCps || []).map((cp) => cp.produto_id));

      // 3. Insert new cotacao_produtos
      const toInsert: { cotacao_id: string; produto_id: string; quantidade: number }[] = [];
      const toUpdate: { id: string; quantidade: number }[] = [];

      for (const item of items) {
        const prod = existingMap.get(item.nome.toLowerCase().trim());
        if (!prod) continue;

        if (existingProdIds.has(prod.id)) {
          const cp = (existingCps || []).find((c) => c.produto_id === prod.id);
          if (cp) toUpdate.push({ id: cp.id, quantidade: item.quantidade });
        } else {
          toInsert.push({ cotacao_id: cotacaoId, produto_id: prod.id, quantidade: item.quantidade });
        }
      }

      if (toInsert.length) {
        await supabase.from("cotacao_produtos").insert(toInsert);
      }
      for (const u of toUpdate) {
        await supabase.from("cotacao_produtos").update({ quantidade: u.quantidade }).eq("id", u.id);
      }

      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      toast.success(`${toInsert.length} novos itens adicionados${toUpdate.length ? `, ${toUpdate.length} quantidades atualizadas` : ""}!`);
      setItems([]);
      setFileName("");
      onOpenChange(false);

      // Auto-suggest fator_embalagem in background for new products
      if (newProductInserts.length > 0) {
        const { autoSuggestFator } = await import("@/lib/autoFator");
        toast.promise(
          autoSuggestFator(newProductInserts, { skipIfAlreadySet: true }).then(updated => {
            if (updated > 0) {
              queryClient.invalidateQueries({ queryKey: ["produtos"] });
              queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
            }
            return updated;
          }),
          {
            loading: "🤖 Analisando fatores de embalagem...",
            success: (updated) => updated > 0 ? `📦 ${updated} fatores de embalagem atualizados pela IA` : "Fatores de embalagem já estão corretos",
            error: "Não foi possível sugerir fatores automaticamente",
          }
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    }
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setItems([]); setFileName(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Lista do ERP
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Importe uma planilha Excel ou CSV do seu ERP. O sistema detecta automaticamente as colunas
          <strong> Produto</strong>, <strong>Quantidade</strong> e <strong>Embalagem</strong>.
        </p>

        {/* Upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">{fileName || "Clique ou arraste o arquivo aqui"}</p>
          <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) ou CSV (.csv)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); e.target.value = ""; }}
          />
        </div>

        {/* Preview */}
        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden flex-1">
            <div className="px-3 py-2 bg-muted border-b flex items-center justify-between">
              <span className="text-xs font-bold">{items.length} itens</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setItems([])}>
                Limpar
              </Button>
            </div>
            <ScrollArea className="max-h-[250px]">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b text-sm hover:bg-muted/30">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  <span className="flex-1 truncate font-medium">{item.nome}</span>
                  <span className="text-xs text-muted-foreground">{item.embalagem}</span>
                  <span className="text-xs font-mono font-bold w-10 text-right">{item.quantidade}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={doImport}
            disabled={!items.length || importing}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
          >
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            {importing ? "Importando..." : `Importar ${items.length} itens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportErpModal;
