import { useState, useRef } from "react";
import { fetchAllProductNames } from "@/lib/supabaseHelpers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import { classifyProductsInBatches } from "@/lib/aiClassify";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: string; nome: string }[];
}

interface ParsedProduct {
  nome: string;
  categoria: string;
  embalagem: string;
  quantidade: number;
  fator: number;
}

const ImportProdutosModal = ({ open, onOpenChange, categorias }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [dupCount, setDupCount] = useState(0);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const { error } = await supabase.from("categorias").insert({ nome: newCatName.trim(), user_id: user?.id });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      toast.success(`Categoria "${newCatName.trim()}" criada!`);
      setNewCatName("");
    } catch (e: any) {
      toast.error(e.message);
    }
    setCreatingCat(false);
  };

  const autoClassify = async () => {
    if (!parsedItems.length) return;
    setClassifying(true);
    try {
      const existingCatNames = categorias.map((c) => c.nome);
      const classifications = await classifyProductsInBatches(parsedItems, existingCatNames);

      if (classifications.length) {
        const updated = parsedItems.map((p) => {
          const match = classifications.find((c: any) => c.nome?.toLowerCase() === p.nome.toLowerCase());
          return match?.categoria ? { ...p, categoria: match.categoria } : p;
        });
        setParsedItems(updated);
        toast.success(`🤖 ${classifications.length} produtos classificados por IA!`);
      } else {
        toast.info("IA não conseguiu classificar os produtos.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro na classificação automática");
    }
    setClassifying(false);
  };

  const processPaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("Cole pelo menos um produto");
      return;
    }
    const items: ParsedProduct[] = lines.map((line) => {
      const parts = line.split(/[;\t]/).map(s => s.trim());
      return {
        nome: parts[0] || line,
        categoria: parts[1] || "Geral",
        embalagem: parts[2] || "un",
        quantidade: parseInt(parts[3]) || 1,
        fator: parseInt(parts[4]) || 1,
      };
    });
    setParsedItems(items);
    setDupCount(0);
    toast.success(`${items.length} produtos detectados!`);
  };

  const processFile = (file: File) => {
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          if (rows.length < 2) {
            toast.error("Arquivo deve ter cabeçalho e pelo menos 1 produto");
            return;
          }

          const headers = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
          const colProd = headers.findIndex((h) =>
            ["produto", "descricao", "item", "nome", "mercadoria", "descrição"].some((k) => h.includes(k))
          );
          const colCat = headers.findIndex((h) =>
            ["categoria", "grupo", "secao", "seção"].some((k) => h.includes(k))
          );
          const colEmbal = headers.findIndex((h) => h.includes("embal") || h.includes("emb") || h.includes("unidade"));
          const colQtd = headers.findIndex((h) =>
            ["quantidade", "qtd", "qtde", "qt"].some((k) => h.includes(k))
          );
          const colFator = headers.findIndex((h) =>
            ["fator unid", "fator", "unid/embalagem"].some((k) => h.includes(k))
          );

          const items: ParsedProduct[] = [];
          rows.slice(1).forEach((row) => {
            const nome = String(row[colProd >= 0 ? colProd : 0] || "").trim();
            if (!nome) return;
            items.push({
              nome,
              categoria: colCat >= 0 ? String(row[colCat] || "Geral").trim() : "Geral",
              embalagem: colEmbal >= 0 ? String(row[colEmbal] || "un").trim() : "un",
              quantidade: colQtd >= 0 ? (parseInt(String(row[colQtd])) || 1) : 1,
              fator: colFator >= 0 ? (parseInt(String(row[colFator])) || 1) : 1,
            });
          });

          setParsedItems(items);
          setDupCount(0);
          toast.success(`${items.length} produtos detectados do arquivo Excel!`);
        } catch (err: any) {
          toast.error("Erro ao ler o arquivo Excel: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV/TXT
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
          ["produto", "descricao", "item", "nome", "mercadoria", "descrição"].some((k) => h.includes(k))
        );
        const colCat = headers.findIndex((h) =>
          ["categoria", "grupo", "secao", "seção"].some((k) => h.includes(k))
        );
        const colEmbal = headers.findIndex((h) => h.includes("embal") || h.includes("emb") || h.includes("unidade"));
        const colQtd = headers.findIndex((h) =>
          ["quantidade", "qtd", "qtde", "qt"].some((k) => h.includes(k))
        );
        const colFator = headers.findIndex((h) =>
          ["fator unid", "fator", "unid/embalagem"].some((k) => h.includes(k))
        );

        const items: ParsedProduct[] = [];
        lines.slice(1).forEach((line) => {
          const cols = parseCSVLine(line, separator);
          const nome = (cols[colProd >= 0 ? colProd : 0] || "").trim();
          if (!nome) return;
          items.push({
            nome,
            categoria: colCat >= 0 ? (cols[colCat] || "Geral").trim() : "Geral",
            embalagem: colEmbal >= 0 ? (cols[colEmbal] || "un").trim() : "un",
            quantidade: colQtd >= 0 ? (parseInt(cols[colQtd]) || 1) : 1,
            fator: colFator >= 0 ? (parseInt(cols[colFator]) || 1) : 1,
          });
        });

        setParsedItems(items);
        setDupCount(0);
        toast.success(`${items.length} produtos detectados do arquivo!`);
      };
      reader.readAsText(file, "utf-8");
    }
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
      // Get existing products to check duplicates (paginated, no 1000-row limit)
      const existingNames = await fetchAllProductNames();

      // Filter out duplicates
      const uniqueItems = parsedItems.filter((p) => !existingNames.has(p.nome.toLowerCase().trim()));
      const dups = parsedItems.length - uniqueItems.length;
      setDupCount(dups);

      if (!uniqueItems.length) {
        toast.info(`Todos os ${parsedItems.length} produtos já existem no banco!`);
        setImporting(false);
        return;
      }

      // Create categories that don't exist
      const existingCats = new Set(categorias.map((c) => c.nome.toLowerCase()));
      const newCats = [...new Set(uniqueItems.map((p) => p.categoria))].filter(
        (c) => c !== "Geral" && !existingCats.has(c.toLowerCase())
      );

      const catMap: Record<string, string> = {};
      categorias.forEach((c) => {
        catMap[c.nome.toLowerCase()] = c.id;
      });

      for (const catName of newCats) {
        const { data, error } = await supabase
          .from("categorias")
          .insert({ nome: catName, user_id: user?.id })
          .select("id")
          .single();
        if (!error && data) catMap[catName.toLowerCase()] = data.id;
      }

      // Insert products in batches and collect inserted IDs
      const batchSize = 50;
      let total = 0;
      const insertedProducts: { id: string; nome: string; embalagem: string; fator_embalagem: number }[] = [];
      for (let i = 0; i < uniqueItems.length; i += batchSize) {
        const batch = uniqueItems.slice(i, i + batchSize).map((p) => ({
          nome: p.nome,
          categoria_id: catMap[p.categoria.toLowerCase()] || null,
          embalagem: p.embalagem || "un",
          fator_embalagem: p.fator > 1 ? p.fator : 1,
          ativo: false,
          user_id: user?.id,
        }));
        const { data: inserted, error } = await supabase.from("produtos").insert(batch).select("id, nome, embalagem, fator_embalagem");
        if (error) throw error;
        if (inserted) insertedProducts.push(...inserted.map(p => ({ ...p, embalagem: p.embalagem || "UNI", fator_embalagem: p.fator_embalagem || 1 })));
        total += batch.length;
      }

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      const msg = dups > 0
        ? `✅ ${total} produtos importados! (${dups} duplicados ignorados)`
        : `✅ ${total} produtos importados!`;
      toast.success(msg);
      setParsedItems([]);
      setPasteText("");
      onOpenChange(false);

      // Auto-suggest fator_embalagem in background
      if (insertedProducts.length > 0) {
        const { autoSuggestFator } = await import("@/lib/autoFator");
        toast.promise(
          autoSuggestFator(insertedProducts, { skipIfAlreadySet: true }).then(updated => {
            if (updated > 0) queryClient.invalidateQueries({ queryKey: ["produtos"] });
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
      toast.error(e.message);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv =
      "Produto,Categoria,Embalagem,Quantidade\nDetergente Ype 500ml,Limpeza,cx,12\nSabao em Po Ariel 1kg,Limpeza,cx,6\nAgua Mineral 500ml,Bebidas,fd,24\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = "modelo_produtos_compra360.csv";
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
              Cole uma lista de produtos (um por linha). Use <code>;</code> para separar: <code>Produto;Categoria;Embalagem;Quantidade</code>
            </p>
            <Textarea
              placeholder={"Detergente Ype 500ml;Limpeza;cx;12\nSabão em Pó Ariel 1kg;Limpeza;cx;6\nÁgua Mineral 500ml"}
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
              Arraste um arquivo CSV ou Excel (.xlsx, .xls) com colunas: Produto, Categoria, Embalagem, Quantidade
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-2xl mb-2">📄</div>
              <p className="text-sm font-semibold text-muted-foreground">
                Clique para selecionar arquivo
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TXT, XLS ou XLSX</p>
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

        {/* Quick category creation */}
        <div className="border rounded-lg p-3 mt-2 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nova Categoria</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
            />
            <Button size="sm" onClick={createCategory} disabled={creatingCat || !newCatName.trim()} variant="outline">
              + Criar
            </Button>
          </div>
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {categorias.map((c) => (
                <span key={c.id} className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{c.nome}</span>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {parsedItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden mt-3">
            <div className="px-3 py-2 bg-green-50 border-b text-xs font-bold text-green-700 flex items-center gap-2">
              <span>✅ {parsedItems.length} produtos prontos para importar</span>
              {dupCount > 0 && <span className="text-amber-600">({dupCount} duplicados serão ignorados)</span>}
              <Button size="sm" variant="outline" className="ml-auto text-xs h-6" onClick={autoClassify} disabled={classifying}>
                {classifying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {classifying ? "Classificando..." : "🤖 Classificar IA"}
              </Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1.5 text-left">Produto</th>
                    <th className="px-2 py-1.5 text-left">Categoria</th>
                    <th className="px-2 py-1.5 text-left">Embal</th>
                    <th className="px-2 py-1.5 text-right">Fator</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.slice(0, 10).map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5">{p.nome}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.categoria}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.embalagem}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{p.embalagem} · {p.fator}</td>
                    </tr>
                  ))}
                  {parsedItems.length > 10 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-center text-muted-foreground">
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
