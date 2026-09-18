import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, X, ChevronLeft, ChevronRight, FileSpreadsheet, Pencil, MessageCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBRL, formatDate, buildWhatsAppUrl } from "@/lib/format";
import {
  FornecedorAdmin, buildFornecedoresXlsx, fornecedoresFilenameXlsx, downloadXlsx,
} from "@/lib/adminExports";
import FornecedorAdminSheet from "./FornecedorAdminSheet";

const PAGE_SIZE = 50;
type Filtro = "todos" | "sem_whatsapp" | "sem_email" | "duplicados";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sem_whatsapp", label: "Sem WhatsApp" },
  { key: "sem_email", label: "Sem e-mail" },
  { key: "duplicados", label: "Duplicados" },
];

export function aplicaFiltro(itens: FornecedorAdmin[], filtro: Filtro): FornecedorAdmin[] {
  if (filtro === "sem_whatsapp") return itens.filter((f) => !f.telefone?.trim());
  if (filtro === "sem_email") return itens.filter((f) => !f.email?.trim());
  if (filtro === "duplicados") return itens.filter((f) => f.duplicado);
  return itens;
}

function localizacao(f: FornecedorAdmin): string {
  if (f.cidade && f.uf) return `${f.cidade}/${f.uf}`;
  return f.cidade || f.uf || "—";
}

export default function FornecedoresTab() {
  const qc = useQueryClient();
  const [termoInput, setTermoInput] = useState("");
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [page, setPage] = useState(0);
  const [detalhe, setDetalhe] = useState<FornecedorAdmin | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(termoInput.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [termoInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-fornecedores", termo, filtro, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_fornecedores", {
        _search: termo || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
        _filtro: filtro,
      });
      if (error) throw error;
      const rows = (data || []) as FornecedorAdmin[];
      return { itens: rows, total: Number(rows[0]?.total_count ?? 0) };
    },
    placeholderData: (prev) => prev,
  });

  const itens = useMemo(() => data?.itens ?? [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin-fornecedores"] });

  const exportar = async () => {
    setExportando(true);
    try {
      const todos: FornecedorAdmin[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.rpc("admin_list_fornecedores", {
          _search: termo || null,
          _limit: 500,
          _offset: offset,
          _filtro: filtro,
        });
        if (error) throw error;
        const rows = (data || []) as FornecedorAdmin[];
        todos.push(...rows);
        if (rows.length < 500) break;
      }
      downloadXlsx(fornecedoresFilenameXlsx(), buildFornecedoresXlsx(todos));
      toast({ title: "Planilha gerada", description: `${todos.length} fornecedor(es) exportado(s).` });
    } catch (e) {
      toast({
        title: "Erro ao exportar",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExportando(false);
    }
  };

  const contador = isLoading
    ? "Carregando…"
    : `${total.toLocaleString("pt-BR")} ${total === 1 ? "fornecedor" : "fornecedores"}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={termoInput}
              onChange={(e) => setTermoInput(e.target.value)}
              placeholder="Buscar por fornecedor, representante, telefone ou e-mail"
              className="pl-8 pr-8"
            />
            {termoInput && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setTermoInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" onClick={exportar} disabled={exportando} className="sm:w-auto">
            {exportando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
            Exportar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filtro === f.key ? "default" : "outline"}
              onClick={() => { setFiltro(f.key); setPage(0); }}
              className="h-8 text-xs"
            >
              {f.label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
            {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            {contador}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum fornecedor encontrado{termo ? ` para "${termo}"` : ""}.
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  <th className="text-left px-3 py-2 font-medium">Representante</th>
                  <th className="text-left px-3 py-2 font-medium w-[130px]">Telefone</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Pedido mín.</th>
                  <th className="text-left px-3 py-2 font-medium w-[100px]">Prazo</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium w-[110px]">Cidade/UF</th>
                  <th className="w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {itens.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="font-medium">{f.nome}</span>
                      {f.duplicado && <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">Duplicado</Badge>}
                      {f.email && <p className="text-[11px] text-muted-foreground break-all">{f.email}</p>}
                    </td>
                    <td className="px-3 py-2">{f.representante || "—"}</td>
                    <td className="px-3 py-2">{f.telefone || "—"}</td>
                    <td className="px-3 py-2 text-right">{f.pedido_minimo ? formatBRL(Number(f.pedido_minimo)) : "—"}</td>
                    <td className="px-3 py-2">{f.prazo_pagamento || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="block truncate max-w-[180px]">{f.cliente_empresa || f.cliente_nome || f.cliente_email || "—"}</span>
                    </td>
                    <td className="px-3 py-2">{localizacao(f)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetalhe(f)} aria-label="Abrir ficha do fornecedor">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {itens.map((f) => (
              <Card key={f.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight break-words">{f.nome}</p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {f.representante || "sem representante"} · {f.telefone || "sem telefone"}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setDetalhe(f)} aria-label="Abrir ficha do fornecedor">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{f.pedido_minimo ? formatBRL(Number(f.pedido_minimo)) : "sem pedido mín."}</span>
                    <span>·</span>
                    <span>{f.prazo_pagamento || "sem prazo"}</span>
                    <span>·</span>
                    <span>{localizacao(f)}</span>
                    {f.duplicado && <Badge variant="secondary" className="text-[10px] py-0">Duplicado</Badge>}
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 gap-2">
                    <span className="text-[11px] text-muted-foreground truncate">
                      {f.cliente_empresa || f.cliente_nome || f.cliente_email || "—"}
                    </span>
                    {f.telefone && (
                      <a
                        href={buildWhatsAppUrl(f.telefone, "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1 shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Cadastrado em {formatDate(f.created_at)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </>
      )}

      <FornecedorAdminSheet
        fornecedor={detalhe}
        onClose={() => setDetalhe(null)}
        onSaved={invalidar}
      />
    </div>
  );
}
