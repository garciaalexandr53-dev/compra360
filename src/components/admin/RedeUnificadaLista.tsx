import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, Pencil, MessageCircle, MapPin, Store } from "lucide-react";
import { formatBRL, buildWhatsAppUrl } from "@/lib/format";
import { formatTelefone, formatNomeEmpresa, formatNomePessoa } from "@/lib/masks";
import { TIPOS_FORNECEDOR, tipoFornecedorLabel, pastasLabel } from "@/lib/adminHelpers";
import { FornecedorAdmin } from "@/lib/adminExports";
import AdicionarALojaDialog from "./AdicionarALojaDialog";

const PAGE_SIZE = 50;

export interface RedeFornecedor {
  id: string;
  nome: string;
  representante: string | null;
  telefone: string | null;
  email: string | null;
  pedido_minimo: number | null;
  prazo_pagamento: string | null;
  created_at: string;
  tipo_fornecedor: string | null;
  pasta: string[] | null;
  origem_cadastro: string | null;
  consentimento_rede: string | null;
  cadastros: number;
  clientes: number;
  lojas_vinculadas: number;
  cidades: string[] | null;
  clientes_nomes: string[] | null;
  na_rede: boolean;
  total_count?: number;
}

/** Converte o registro unificado no formato usado pela ficha do fornecedor. */
export function paraFornecedorAdmin(r: RedeFornecedor): FornecedorAdmin {
  return {
    id: r.id,
    nome: r.nome,
    representante: r.representante,
    telefone: r.telefone,
    email: r.email,
    pedido_minimo: r.pedido_minimo,
    prazo_pagamento: r.prazo_pagamento,
    created_at: r.created_at,
    user_id: null,
    cliente_nome: r.clientes_nomes?.[0] ?? null,
    cliente_empresa: r.clientes_nomes?.[0] ?? null,
    cliente_email: null,
    cidade: r.cidades?.[0] ?? null,
    uf: null,
    lojas_vinculadas: r.lojas_vinculadas ?? 0,
    duplicado: (r.cadastros ?? 1) > 1,
    tipo_fornecedor: r.tipo_fornecedor,
    pasta: r.pasta,
    origem_cadastro: r.origem_cadastro,
  };
}

/** Texto curto de presença: em quantos clientes e lojas o fornecedor está. */
export function presencaLabel(r: Pick<RedeFornecedor, "clientes" | "lojas_vinculadas">): string {
  const c = Number(r.clientes ?? 0);
  const l = Number(r.lojas_vinculadas ?? 0);
  const partes = [`${c} ${c === 1 ? "cliente" : "clientes"}`];
  if (l > 0) partes.push(`${l} ${l === 1 ? "loja" : "lojas"}`);
  return partes.join(" · ");
}

export default function RedeUnificadaLista({
  termo,
  onAbrirFicha,
}: {
  termo: string;
  onAbrirFicha: (f: FornecedorAdmin) => void;
}) {
  const [cidade, setCidade] = useState("todas");
  const [uf, setUf] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [somenteRede, setSomenteRede] = useState(false);
  const [page, setPage] = useState(0);
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [lojaDialog, setLojaDialog] = useState(false);
  const queryClient = useQueryClient();

  const selecionados = useMemo(
    () => Object.entries(selecao).map(([id, nome]) => ({ id, nome })),
    [selecao],
  );
  const toggleSel = (id: string, nome: string) =>
    setSelecao((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = nome;
      return next;
    });

  const { data: filtros = [] } = useQuery({
    queryKey: ["admin-rede-filtros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_rede_filtros");
      if (error) throw error;
      return (data || []) as { cidade: string; uf: string; fornecedores: number }[];
    },
  });

  const cidades = useMemo(
    () => [...new Set(filtros.map((f) => f.cidade))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [filtros],
  );
  const ufs = useMemo(
    () => [...new Set(filtros.map((f) => f.uf).filter(Boolean))].sort(),
    [filtros],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-rede-unificada", termo, cidade, uf, tipo, somenteRede, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_rede_fornecedores", {
        _search: termo || null,
        _cidade: cidade === "todas" ? null : cidade,
        _uf: uf === "todos" ? null : uf,
        _tipo: tipo === "todos" ? null : tipo,
        _somente_rede: somenteRede,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as RedeFornecedor[];
      return { itens: rows, total: Number(rows[0]?.total_count ?? 0) };
    },
    placeholderData: (prev) => prev,
  });

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reset = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Select value={cidade} onValueChange={(v) => reset(() => setCidade(v))}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as cidades</SelectItem>
            {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={uf} onValueChange={(v) => reset(() => setUf(v))}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={(v) => reset(() => setTipo(v))}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {TIPOS_FORNECEDOR.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={somenteRede ? "default" : "outline"}
          className="h-9 text-xs"
          onClick={() => reset(() => setSomenteRede((v) => !v))}
        >
          Somente da Rede
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setSelecao((prev) => {
              const next = { ...prev };
              itens.forEach((f) => { next[f.id] = f.nome; });
              return next;
            })}
          >
            Selecionar todos da página
          </Button>
          {selecionados.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelecao({})}>
              Limpar seleção
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} ${total === 1 ? "fornecedor" : "fornecedores"} (sem repetição)`}
        </div>
      </div>

      {selecionados.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">
            {selecionados.length} {selecionados.length === 1 ? "fornecedor selecionado" : "fornecedores selecionados"}
          </span>
          <Button size="sm" className="h-8 text-xs" onClick={() => setLojaDialog(true)}>
            <Store className="h-3.5 w-3.5 mr-1.5" /> Adicionar a uma loja
          </Button>
        </div>
      )}

      <AdicionarALojaDialog
        open={lojaDialog}
        onOpenChange={setLojaDialog}
        selecionados={selecionados}
        onRemover={(id) => setSelecao((prev) => { const n = { ...prev }; delete n[id]; return n; })}
        onConcluido={() => {
          setSelecao({});
          queryClient.invalidateQueries({ queryKey: ["admin-rede-unificada"] });
          queryClient.invalidateQueries({ queryKey: ["admin-lojas-clientes"] });
        }}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum fornecedor encontrado com esses filtros.
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="w-[36px] px-2 py-2" />
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  <th className="text-left px-3 py-2 font-medium">Representante</th>
                  <th className="text-left px-3 py-2 font-medium w-[130px]">WhatsApp</th>
                  <th className="text-left px-3 py-2 font-medium">Cidades atendidas</th>
                  <th className="text-left px-3 py-2 font-medium w-[150px]">Presença</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Pedido mín.</th>
                  <th className="w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {itens.map((f) => (
                  <tr key={f.id} className={`border-t hover:bg-muted/30 ${selecao[f.id] ? "bg-primary/5" : ""}`}>
                    <td className="px-2 py-2">
                      <Checkbox
                        checked={!!selecao[f.id]}
                        onCheckedChange={() => toggleSel(f.id, f.nome)}
                        aria-label={`Selecionar ${f.nome}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{formatNomeEmpresa(f.nome)}</span>
                      {f.na_rede && <Badge className="ml-1.5 text-[10px] py-0">Rede</Badge>}
                      {Number(f.cadastros) > 1 && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">
                          {f.cadastros} cadastros
                        </Badge>
                      )}
                      {f.tipo_fornecedor && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] py-0">{tipoFornecedorLabel(f.tipo_fornecedor)}</Badge>
                      )}
                      {pastasLabel(f.pasta) && (
                        <p className="text-[11px] text-muted-foreground break-words">{pastasLabel(f.pasta)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatNomePessoa(f.representante) || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTelefone(f.telefone) || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {f.cidades?.length ? f.cidades.slice(0, 4).join(", ") + (f.cidades.length > 4 ? ` +${f.cidades.length - 4}` : "") : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{presencaLabel(f)}</td>
                    <td className="px-3 py-2 text-right">{f.pedido_minimo ? formatBRL(Number(f.pedido_minimo)) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onAbrirFicha(paraFornecedorAdmin(f))} aria-label="Abrir ficha do fornecedor">
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
              <Card key={f.id} className={selecao[f.id] ? "border-primary/60 bg-primary/5" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={!!selecao[f.id]}
                      onCheckedChange={() => toggleSel(f.id, f.nome)}
                      className="mt-0.5 shrink-0"
                      aria-label={`Selecionar ${f.nome}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight break-words">{formatNomeEmpresa(f.nome)}</p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {formatNomePessoa(f.representante) || "sem representante"} · {formatTelefone(f.telefone) || "sem WhatsApp"}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onAbrirFicha(paraFornecedorAdmin(f))} aria-label="Abrir ficha do fornecedor">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.na_rede && <Badge className="text-[10px] py-0">Rede</Badge>}
                    {Number(f.cadastros) > 1 && (
                      <Badge variant="secondary" className="text-[10px] py-0">{f.cadastros} cadastros</Badge>
                    )}
                    {f.tipo_fornecedor && (
                      <Badge variant="outline" className="text-[10px] py-0">{tipoFornecedorLabel(f.tipo_fornecedor)}</Badge>
                    )}
                  </div>
                  {f.cidades?.length ? (
                    <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-px" />
                      <span className="break-words">{f.cidades.slice(0, 5).join(", ")}{f.cidades.length > 5 ? ` +${f.cidades.length - 5}` : ""}</span>
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between border-t pt-2 gap-2">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Store className="h-3.5 w-3.5" /> {presencaLabel(f)}
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
    </div>
  );
}
