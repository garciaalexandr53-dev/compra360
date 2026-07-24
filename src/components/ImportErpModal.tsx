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
  ean: string | null;
}

export const extractEan = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
};

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
    const eanIdx = lower.findIndex((h) =>
      ["ean", "ean13", "gtin", "codigo de barras", "código de barras", "cod barras", "codbarras", "barcode", "codigo", "código"].includes(h)
    );
    return { nomeIdx: nomeIdx >= 0 ? nomeIdx : 0, qtdIdx, embIdx, eanIdx };
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
        const { nomeIdx, qtdIdx, embIdx, eanIdx } = detectColumns(headers);

        const parsed: ParsedItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map((c) => c.replace(/"/g, "").trim());
          const nome = cols[nomeIdx]?.trim();
          if (!nome) continue;
          parsed.push({
            nome,
            quantidade: qtdIdx >= 0 ? parseFloat(cols[qtdIdx]?.replace(",", ".")) || 1 : 1,
            embalagem: embIdx >= 0 ? cols[embIdx] || "un" : "un",
            ean: eanIdx >= 0 ? extractEan(cols[eanIdx]) : null,
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
        const { nomeIdx, qtdIdx, embIdx, eanIdx } = detectColumns(headers);

        const parsed: ParsedItem[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const nome = String(row[nomeIdx] || "").trim();
          if (!nome) continue;
          parsed.push({
            nome,
            quantidade: qtdIdx >= 0 ? parseFloat(String(row[qtdIdx] || "1").replace(",", ".")) || 1 : 1,
            embalagem: embIdx >= 0 ? String(row[embIdx] || "un").trim() : "un",
            ean: eanIdx >= 0 ? extractEan(row[eanIdx]) : null,
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
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        toast.error("Sessão expirada. Faça login novamente.");
        setImporting(false);
        return;
      }

      const { buildSnapshotInsert } = await import("@/lib/buscaProdutos");
      const { fetchAllProductsMap } = await import("@/lib/supabaseHelpers");

      // 1. Casar por EAN no catálogo mestre
      const eans = Array.from(new Set(items.map((i) => i.ean).filter((e): e is string => !!e)));
      const catalogByEan = new Map<string, { id: string; nome: string; ean: string; embalagem: string | null; fator_embalagem: number | null }>();
      if (eans.length) {
        const { data: catRows, error: catErr } = await supabase
          .from("catalogo_mestre")
          .select("id, nome, ean, embalagem, fator_embalagem")
          .eq("ativo", true)
          .in("ean", eans);
        if (catErr) throw catErr;
        (catRows || []).forEach((r) => { if (r.ean) catalogByEan.set(r.ean, r as any); });
      }

      // 2. Carregar produtos locais existentes (por nome)
      const existingMap = await fetchAllProductsMap();

      // 3. Determinar quais itens caem em cada bucket
      type Bucket =
        | { kind: "catalogo"; item: ParsedItem; cat: { id: string; nome: string; ean: string; embalagem: string | null; fator_embalagem: number | null } }
        | { kind: "local"; item: ParsedItem; prod: { id: string; nome: string; embalagem: string | null; fator_embalagem: number } };
      const buckets: Bucket[] = [];
      const toCreateLocal: ParsedItem[] = [];

      for (const item of items) {
        const catHit = item.ean ? catalogByEan.get(item.ean) : undefined;
        if (catHit) {
          buckets.push({ kind: "catalogo", item, cat: catHit });
          continue;
        }
        const existing = existingMap.get(item.nome.toLowerCase().trim());
        if (existing) {
          buckets.push({ kind: "local", item, prod: existing });
        } else {
          toCreateLocal.push(item);
        }
      }

      // 4. Criar produtos locais faltantes com user_id — checando erro
      const newProductInserts: { id: string; nome: string; embalagem: string; fator_embalagem: number }[] = [];
      if (toCreateLocal.length) {
        const { data: inserted, error: insErr } = await supabase
          .from("produtos")
          .insert(toCreateLocal.map((p) => ({
            nome: p.nome,
            embalagem: p.embalagem,
            ativo: true,
            user_id: uid,
          })) as any)
          .select("id, nome, embalagem, fator_embalagem");
        if (insErr) throw insErr;
        (inserted || []).forEach((p, idx) => {
          const src = toCreateLocal[idx];
          existingMap.set(p.nome.toLowerCase().trim(), p as any);
          buckets.push({ kind: "local", item: src, prod: p as any });
          newProductInserts.push({
            id: p.id,
            nome: p.nome,
            embalagem: p.embalagem || "UNI",
            fator_embalagem: p.fator_embalagem || 1,
          });
        });
      }

      // 5. Descobrir o que já está na cotação (produto_id ou catalogo_mestre_id)
      const { data: existingCps, error: cpsErr } = await supabase
        .from("cotacao_produtos")
        .select("id, produto_id, catalogo_mestre_id")
        .eq("cotacao_id", cotacaoId);
      if (cpsErr) throw cpsErr;
      const cpsByProd = new Map<string, string>();
      const cpsByCat = new Map<string, string>();
      (existingCps || []).forEach((cp: any) => {
        if (cp.produto_id) cpsByProd.set(cp.produto_id, cp.id);
        if (cp.catalogo_mestre_id) cpsByCat.set(cp.catalogo_mestre_id, cp.id);
      });

      // 6. Montar inserts e updates via buildSnapshotInsert
      const toInsert: any[] = [];
      const toUpdate: { id: string; quantidade: number }[] = [];

      for (const b of buckets) {
        if (b.kind === "catalogo") {
          const existingId = cpsByCat.get(b.cat.id);
          if (existingId) {
            toUpdate.push({ id: existingId, quantidade: b.item.quantidade });
          } else {
            toInsert.push(buildSnapshotInsert({
              cotacaoId,
              quantidade: b.item.quantidade,
              produto: {
                fonte: "catalogo",
                id: b.cat.id,
                nome: b.cat.nome,
                ean: b.cat.ean,
                embalagem: b.cat.embalagem,
                fator_embalagem: b.cat.fator_embalagem,
              },
            }));
          }
        } else {
          const existingId = cpsByProd.get(b.prod.id);
          if (existingId) {
            toUpdate.push({ id: existingId, quantidade: b.item.quantidade });
          } else {
            toInsert.push(buildSnapshotInsert({
              cotacaoId,
              quantidade: b.item.quantidade,
              produto: {
                fonte: "local",
                id: b.prod.id,
                nome: b.prod.nome,
                ean: null,
                embalagem: b.prod.embalagem,
                fator_embalagem: b.prod.fator_embalagem,
              },
              embalagem: b.item.embalagem,
            }));
          }
        }
      }

      if (toInsert.length) {
        const { error: insertErr } = await supabase.from("cotacao_produtos").insert(toInsert);
        if (insertErr) throw insertErr;
      }
      for (const u of toUpdate) {
        const { error: updErr } = await supabase.from("cotacao_produtos").update({ quantidade: u.quantidade }).eq("id", u.id);
        if (updErr) throw updErr;
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
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{item.nome}</div>
                    {item.ean && (
                      <div className="text-[10px] font-mono text-muted-foreground truncate">EAN: {item.ean}</div>
                    )}
                  </div>
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
