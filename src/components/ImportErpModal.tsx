// build: erp-import-v2
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Trash2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export interface ParsedItem {
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

/** Mapa de embalagem da planilha → sigla canônica (apenas itens LOCAIS). */
const EMBALAGEM_MAP: Record<string, string> = {
  cx: "CX",
  fd: "FD",
  kg: "KG",
  sc: "PCT",
  unid: "UNI",
  uni: "UNI",
  un: "UNI",
  dz: "DZ",
  pct: "PCT",
  pc: "PCT",
};

export const normalizeEmbalagem = (raw: unknown): string => {
  const key = String(raw ?? "").trim().toLowerCase();
  return EMBALAGEM_MAP[key] ?? "UNI";
};

export type DestinoItem = "catalogo" | "local";

/** Caso 1: tem EAN e existe no mestre → catálogo. Casos 2/3 → local. */
export const classificarDestino = (
  item: Pick<ParsedItem, "ean">,
  catalogByEan: Map<string, unknown>,
): DestinoItem =>
  item.ean && catalogByEan.has(String(item.ean)) ? "catalogo" : "local";

export interface CatRow {
  id: string;
  nome: string;
  ean: string;
  embalagem: string | null;
  fator_embalagem: number | null;
}

/** Busca TODOS os EANs da planilha em UMA query (ean como TEXT). */
export const fetchCatalogByEan = async (
  parsed: Pick<ParsedItem, "ean">[],
): Promise<Map<string, CatRow>> => {
  const map = new Map<string, CatRow>();
  const eans = Array.from(
    new Set(parsed.map((i) => i.ean).filter((e): e is string => !!e)),
  );
  if (!eans.length) return map;
  const { data, error } = await supabase
    .from("catalogo_mestre")
    .select("id, nome, ean, embalagem, fator_embalagem")
    .eq("ativo", true)
    .in("ean", eans);
  if (error) throw error;
  (data || []).forEach((r: any) => {
    if (r.ean) map.set(String(r.ean), r as CatRow);
  });
  return map;
};

/** Chave canônica de nome para match EXATO (nunca ILIKE/contains). */
export const nomeKey = (nome: string): string => nome.toLowerCase().trim();

export interface LocalProd {
  id: string;
  nome: string;
  embalagem: string | null;
  fator_embalagem: number;
}

/** Match EXATO por nome. Nome parecido NÃO casa — retorna null (cria novo). */
export const findLocalExato = (
  nome: string,
  existingMap: Map<string, LocalProd>,
): LocalProd | null => existingMap.get(nomeKey(nome)) ?? null;

export interface PlanoLinha {
  destino: DestinoItem;
  /** chave de dedup: catalogo:<id> | local:<nome> */
  key: string;
  item: ParsedItem;
  cat?: CatRow;
  prod?: LocalProd | null;
  embalagem: string;
}

/**
 * Plano por linha da planilha, já deduplicado (mesmo item 2x = 1 linha).
 * Não faz IO — testável.
 */
export const planejarLinhas = (
  items: ParsedItem[],
  catMap: Map<string, CatRow>,
  existingMap: Map<string, LocalProd>,
): PlanoLinha[] => {
  const byKey = new Map<string, PlanoLinha>();
  for (const item of items) {
    const cat = item.ean ? catMap.get(String(item.ean)) : undefined;
    const linha: PlanoLinha = cat
      ? { destino: "catalogo", key: `catalogo:${cat.id}`, item, cat, embalagem: "" }
      : {
          destino: "local",
          key: `local:${nomeKey(item.nome)}`,
          item,
          prod: findLocalExato(item.nome, existingMap),
          embalagem: normalizeEmbalagem(item.embalagem),
        };
    byKey.set(linha.key, linha); // última quantidade vence
  }
  return Array.from(byKey.values());
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
  const [catalogByEan, setCatalogByEan] = useState<Map<string, CatRow>>(new Map());

  /** Uma única query: todos os EANs da planilha, comparados como TEXT. */
  const loadCatalogHits = async (parsed: ParsedItem[]) => {
    const map = await fetchCatalogByEan(parsed);
    setCatalogByEan(map);
  };

  const applyParsed = (parsed: ParsedItem[]) => {
    setItems(parsed);
    setCatalogByEan(new Map());
    if (parsed.length) {
      toast.success(`${parsed.length} itens detectados`);
      loadCatalogHits(parsed);
    } else {
      toast.error("Nenhum item encontrado no arquivo");
    }
  };


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
        applyParsed(parsed);

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
        applyParsed(parsed);

      };
      reader.readAsArrayBuffer(file);
    }
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const doImport = async () => {
    if (!items.length) return;
    setImporting(true);
    try {
      console.log("[ImportErp v2] iniciando import", { total: items.length, comEan: items.filter(i => i.ean).length });
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        toast.error("Sessão expirada. Faça login novamente.");
        setImporting(false);
        return;
      }

      const { buildSnapshotInsert } = await import("@/lib/buscaProdutos");
      const { fetchAllProductsMap } = await import("@/lib/supabaseHelpers");

      // 1. Casar por EAN no catálogo mestre (reaproveita o lookup do preview)
      const catMap = catalogByEan.size ? catalogByEan : await fetchCatalogByEan(items);
      console.log("[ImportErp v2] catálogo casado por EAN:", catMap.size);

      // 2. Carregar produtos locais existentes (por nome)
      const existingMap = await fetchAllProductsMap();

      // 3. Plano por linha (match EXATO de nome + dedup de linhas repetidas)
      const plano = planejarLinhas(items, catMap, existingMap as Map<string, LocalProd>);
      const aCriar = plano.filter((l) => l.destino === "local" && !l.prod);
      console.log("[ImportErp v2] plano linhas:", {
        total: plano.length,
        catalogo: plano.filter((l) => l.destino === "catalogo").length,
        local: plano.filter((l) => l.destino === "local").length,
        aCriar: aCriar.length,
      });

      // 4. Criar produtos locais faltantes com user_id — checando erro
      const newProductInserts: { id: string; nome: string; embalagem: string; fator_embalagem: number }[] = [];
      if (aCriar.length) {
        const { data: inserted, error: insErr } = await supabase
          .from("produtos")
          .insert(aCriar.map((l) => ({
            nome: l.item.nome,
            embalagem: l.embalagem,
            ativo: true,
            user_id: uid,
          })) as any)
          .select("id, nome, embalagem, fator_embalagem");
        if (insErr) {
          console.error("[ImportErp v2] erro criando produtos locais:", insErr);
          if (insErr.code === "42501") {
            throw new Error("Sessão expirada ou sem permissão para cadastrar produtos. Recarregue a página (Ctrl+Shift+R) e tente novamente.");
          }
          throw insErr;
        }
        (inserted || []).forEach((p, idx) => {
          const linha = aCriar[idx];
          existingMap.set(nomeKey(p.nome), p as any);
          linha.prod = p as any;
          newProductInserts.push({
            id: p.id,
            nome: p.nome,
            embalagem: p.embalagem || "UNI",
            fator_embalagem: p.fator_embalagem || 1,
          });
        });
      }

      if (plano.length === 0) {
        toast.error("Nenhum item foi processado — verifique se o arquivo tem colunas Produto/EAN válidas.");
        setImporting(false);
        return;
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

      // 6. Montar inserts e updates via buildSnapshotInsert (sem duplicar na cotação)
      const { getFatorPadrao } = await import("@/lib/embalagemFatores");
      const toInsert: any[] = [];
      const toUpdate: { id: string; quantidade: number }[] = [];
      const jaPlanejado = new Set<string>();

      for (const l of plano) {
        if (l.destino === "catalogo" && l.cat) {
          const existingId = cpsByCat.get(l.cat.id);
          if (existingId) {
            toUpdate.push({ id: existingId, quantidade: l.item.quantidade });
            continue;
          }
          if (jaPlanejado.has(l.key)) continue;
          jaPlanejado.add(l.key);
          toInsert.push(buildSnapshotInsert({
            cotacaoId,
            quantidade: l.item.quantidade,
            produto: {
              fonte: "catalogo",
              id: l.cat.id,
              nome: l.cat.nome,
              ean: l.cat.ean,
              embalagem: l.cat.embalagem,
              fator_embalagem: l.cat.fator_embalagem,
            },
          }));
        } else if (l.prod) {
          const existingId = cpsByProd.get(l.prod.id);
          if (existingId) {
            toUpdate.push({ id: existingId, quantidade: l.item.quantidade });
            continue;
          }
          const key = `local:${l.prod.id}`;
          if (jaPlanejado.has(key)) continue;
          jaPlanejado.add(key);
          const fatorProd = l.prod.fator_embalagem;
          toInsert.push(buildSnapshotInsert({
            cotacaoId,
            quantidade: l.item.quantidade,
            produto: {
              fonte: "local",
              id: l.prod.id,
              nome: l.prod.nome,
              ean: null,
              embalagem: l.embalagem,
              fator_embalagem: null,
            },
            embalagem: l.embalagem,
            fator: fatorProd && fatorProd > 1 ? fatorProd : getFatorPadrao(l.embalagem),
          }));
        }

        }
      }

      console.log("[ImportErp v2] plano final:", { toInsert: toInsert.length, toUpdate: toUpdate.length });
      if (toInsert.length) {
        const { error: insertErr } = await supabase.from("cotacao_produtos").insert(toInsert);
        if (insertErr) {
          console.error("[ImportErp v2] erro inserindo cotacao_produtos:", insertErr);
          throw insertErr;
        }
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
              {items.map((item, i) => {
                const destino = classificarDestino(item, catalogByEan);
                return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-b text-sm hover:bg-muted/30">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{item.nome}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          destino === "catalogo"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {destino === "catalogo" ? "Catálogo" : "Local"}
                      </span>
                      {item.ean && (
                        <span className="text-[10px] font-mono text-muted-foreground truncate">EAN: {item.ean}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                    {destino === "catalogo" ? "—" : normalizeEmbalagem(item.embalagem)}
                  </span>
                  <span className="text-xs font-mono font-bold w-10 text-right shrink-0">{item.quantidade}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                );
              })}

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
