import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: string; nome: string }[];
}

interface ParsedProduct {
  nome: string;
  categoria: string;
  embalagem: string;
}

const ImportProdutosModal = ({ open, onOpenChange, categorias }: Props) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedProduct[]>([]);
  const [importing, setImporting] = useState(false);

  const processPaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("Cole pelo menos um produto");
      return;
    }
    const items: ParsedProduct[] = lines.map((line) => ({
      nome: line,
      categoria: "Geral",
      embalagem: "un",
    }));
    setParsedItems(items);
    toast.success(`${items.length} produtos detectados!`);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("Arquivo deve ter cabeçalho e pelo menos 1 produto");
        return;
      }

      const separator = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(separator).map((h) => h.replace(/"/g, "").trim().toLowerCase());

      const colProd = headers.findIndex((h) =>
        ["produto", "descricao", "item", "nome", "mercadoria"].some((k) => h.includes(k))
      );
      const colCat = headers.findIndex((h) =>
        ["categoria", "grupo", "secao"].some((k) => h.includes(k))
      );
      const colEmbal = headers.findIndex((h) => h.includes("embal") || h.includes("emb"));

      const items: ParsedProduct[] = [];
      lines.slice(1).forEach((line) => {
        const cols = parseCSVLine(line, separator);
        const nome = (cols[colProd >= 0 ? colProd : 0] || "").trim();
        if (!nome) return;
        items.push({
          nome,
          categoria: colCat >= 0 ? (cols[colCat] || "Geral").trim() : "Geral",
          embalagem: colEmbal >= 0 ? (cols[colEmbal] || "un").trim() : "un",
        });
      });

      setParsedItems(items);
      toast.success(`${items.length} produtos detectados do arquivo!`);
    };
    reader.readAsText(file, "utf-8");
  };

  const parseCSVLine = (line: string, sep: string): string[] => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === sep && !inQ) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const doImport = async () => {
    if (!parsedItems.length) return;
    setImporting(true);
    try {
      // Create categories that don't exist
      const existingCats = new Set(categorias.map((c) => c.nome.toLowerCase()));
      const newCats = [...new Set(parsedItems.map((p) => p.categoria))].filter(
        (c) => c !== "Geral" && !existingCats.has(c.toLowerCase())
      );

      const catMap: Record<string, string> = {};
      categorias.forEach((c) => {
        catMap[c.nome.toLowerCase()] = c.id;
      });

      for (const catName of newCats) {
        const { data, error } = await supabase
          .from("categorias")
          .insert({ nome: catName })
          .select("id")
          .single();
        if (!error && data) catMap[catName.toLowerCase()] = data.id;
      }

      // Insert products in batches
      const batchSize = 50;
      let total = 0;
      for (let i = 0; i < parsedItems.length; i += batchSize) {
        const batch = parsedItems.slice(i, i + batchSize).map((p) => ({
          nome: p.nome,
          categoria_id: catMap[p.categoria.toLowerCase()] || null,
          embalagem: p.embalagem || "un",
          ativo: false,
        }));
        const { error } = await supabase.from("produtos").insert(batch);
        if (error) throw error;
        total += batch.length;
      }

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success(`✅ ${total} produtos importados!`);
      setParsedItems([]);
      setPasteText("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv =
      "Produto,Categoria,Embalagem\nDetergente Ype 500ml,Limpeza,cx\nSabao em Po Ariel 1kg,Limpeza,cx\nAgua Mineral 500ml,Bebidas,fd\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "modelo_produtos_cotafacil.csv";
    a.click();
    toast.success("Modelo baixado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>📥 Importar Produtos</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="colar">
          <TabsList className="w-full">
            <TabsTrigger value="colar" className="flex-1">📋 Colar Lista</TabsTrigger>
            <TabsTrigger value="arquivo" className="flex-1">📄 CSV / Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="colar" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cole uma lista de produtos (um por linha):
            </p>
            <Textarea
              placeholder={"Detergente Ype 500ml\nSabão em Pó Ariel 1kg\nÁgua Mineral 500ml"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
            />
            <Button size="sm" variant="outline" onClick={processPaste} disabled={!pasteText.trim()}>
              Processar lista
            </Button>
          </TabsContent>

          <TabsContent value="arquivo" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Arraste um arquivo CSV ou Excel com colunas: Produto, Categoria, Embalagem
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm font-semibold text-muted-foreground">
                Clique para selecionar arquivo
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TXT ou XLS</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button size="sm" variant="ghost" onClick={downloadTemplate} className="text-xs">
              ↓ Baixar modelo CSV
            </Button>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {parsedItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden mt-3">
            <div className="px-3 py-2 bg-green-50 border-b text-xs font-bold text-green-700">
              ✅ {parsedItems.length} produtos prontos para importar
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1.5 text-left">Produto</th>
                    <th className="px-2 py-1.5 text-left">Categoria</th>
                    <th className="px-2 py-1.5 text-left">Embal</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.slice(0, 10).map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5">{p.nome}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.categoria}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.embalagem}</td>
                    </tr>
                  ))}
                  {parsedItems.length > 10 && (
                    <tr>
                      <td colSpan={3} className="px-2 py-1.5 text-center text-muted-foreground">
                        ... e mais {parsedItems.length - 10} produtos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={doImport}
            disabled={!parsedItems.length || importing}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
          >
            {importing ? "Importando..." : `Importar ${parsedItems.length} Produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProdutosModal;
