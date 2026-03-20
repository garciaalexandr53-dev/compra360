import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClipboardCheck, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, User, Clock, Filter, CalendarIcon, X, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConferenciaRow {
  id: string;
  created_at: string;
  conferido_por: string;
  observacoes: string | null;
  pedido_id: string;
  pedidos: {
    numero: number;
    total: number | null;
    fornecedor_id: string;
    loja_id: string | null;
    fornecedores: { id: string; nome: string };
    lojas: { nome: string; cnpj: string | null; razao_social: string | null; inscricao_estadual: string | null; endereco: string | null } | null;
  };
}

interface ConferenciaItem {
  id: string;
  produto_nome: string;
  embalagem: string | null;
  quantidade_pedida: number;
  quantidade_recebida: number;
  preco_cotado: number | null;
  preco_nf: number | null;
  divergencia_qtd: boolean;
  divergencia_preco: boolean;
}

const ConferenciasPage = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>("todos");
  const [filtroDivergencia, setFiltroDivergencia] = useState<string>("todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const { data: conferencias = [], isLoading } = useQuery({
    queryKey: ["conferencias-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conferencias")
        .select("id, created_at, conferido_por, observacoes, pedido_id, pedidos(numero, total, fornecedor_id, loja_id, fornecedores(id, nome), lojas(nome, cnpj, razao_social, inscricao_estadual, endereco))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ConferenciaRow[]) || [];
    },
  });

  // Fetch ALL conference items to know which conferences have divergências
  const allConferenciaIds = useMemo(() => conferencias.map((c) => c.id), [conferencias]);

  const { data: allItens = [] } = useQuery({
    queryKey: ["all-conferencia-itens", allConferenciaIds],
    enabled: allConferenciaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conferencia_itens")
        .select("*")
        .in("conferencia_id", allConferenciaIds);
      if (error) throw error;
      return (data as ConferenciaItem[]) || [];
    },
  });

  // Map: conferencia_id -> has divergence
  const divergenciaMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of allItens) {
      if (item.divergencia_qtd || item.divergencia_preco) {
        map.set((item as any).conferencia_id, true);
      }
    }
    return map;
  }, [allItens]);

  // Items for expanded conference
  const expandedItens = useMemo(
    () => expandedId ? allItens.filter((i: any) => i.conferencia_id === expandedId) : [],
    [allItens, expandedId]
  );

  // Unique suppliers for filter
  const fornecedores = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of conferencias) {
      if (c.pedidos?.fornecedores) {
        map.set(c.pedidos.fornecedores.id, c.pedidos.fornecedores.nome);
      }
    }
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [conferencias]);

  // Apply filters
  const filtered = useMemo(() => {
    return conferencias.filter((c) => {
      // Fornecedor filter
      if (filtroFornecedor !== "todos" && c.pedidos?.fornecedores?.id !== filtroFornecedor) return false;

      // Date range filter
      const date = new Date(c.created_at);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (date < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (date > to) return false;
      }

      // Divergência filter
      if (filtroDivergencia === "com") {
        if (!divergenciaMap.get(c.id)) return false;
      } else if (filtroDivergencia === "sem") {
        if (divergenciaMap.get(c.id)) return false;
      }

      return true;
    });
  }, [conferencias, filtroFornecedor, dateFrom, dateTo, filtroDivergencia, divergenciaMap]);

  const activeFilters = (filtroFornecedor !== "todos" ? 1 : 0) + (filtroDivergencia !== "todos" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearFilters = () => {
    setFiltroFornecedor("todos");
    setFiltroDivergencia("todos");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }


  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Conferências</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{conferencias.length}</span>
          {Array.from(divergenciaMap.values()).filter(Boolean).length > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              {Array.from(divergenciaMap.values()).filter(Boolean).length} com divergência
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-8 text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            Filtros
            {activeFilters > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{activeFilters}</Badge>}
          </Button>
        </div>
      </div>

      {/* Collapsible filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
            <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroDivergencia} onValueChange={setFiltroDivergencia}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Divergências" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="com">Com divergência</SelectItem>
              <SelectItem value="sem">Sem divergência</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3 mr-1" />{dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3 mr-1" />{dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {activeFilters > 0 && (
        <p className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {conferencias.length} conferência(s)
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {conferencias.length === 0 ? "Nenhuma conferência realizada ainda." : "Nenhuma conferência encontrada com os filtros aplicados."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((conf) => {
            const isExpanded = expandedId === conf.id;
            const hasDivergence = divergenciaMap.get(conf.id) || false;
            const itemsForConf = isExpanded ? expandedItens : [];
            const divergencias = itemsForConf.filter((i) => i.divergencia_qtd || i.divergencia_preco);

            return (
              <Card key={conf.id} className={cn("overflow-hidden", hasDivergence && "border-destructive/30")}>
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggle(conf.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", hasDivergence ? "bg-destructive/10" : "bg-primary/10")}>
                        {hasDivergence
                          ? <AlertTriangle className="h-4 w-4 text-destructive" />
                          : <CheckCircle2 className="h-4 w-4 text-primary" />
                        }
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          Pedido #{conf.pedidos?.numero} — {conf.pedidos?.fornecedores?.nome}
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {conf.conferido_por}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(conf.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasDivergence && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 hidden sm:inline-flex">
                          Divergência
                        </Badge>
                      )}
                      {conf.pedidos?.total && (
                        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                          {formatBRL(conf.pedidos?.total)}
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {/* Billing data */}
                    {conf.pedidos?.lojas && (
                      <div className="bg-muted/50 border rounded-lg p-3 mb-3 text-xs space-y-0.5">
                        <p className="font-bold text-sm mb-1">📄 Dados para Faturamento</p>
                        <p><span className="text-muted-foreground">Loja:</span> {conf.pedidos.lojas.nome}</p>
                        {conf.pedidos.lojas.razao_social && <p><span className="text-muted-foreground">Razão Social:</span> {conf.pedidos.lojas.razao_social}</p>}
                        {conf.pedidos.lojas.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {conf.pedidos.lojas.cnpj}</p>}
                        {conf.pedidos.lojas.inscricao_estadual && <p><span className="text-muted-foreground">IE:</span> {conf.pedidos.lojas.inscricao_estadual}</p>}
                        {conf.pedidos.lojas.endereco && <p><span className="text-muted-foreground">Endereço:</span> {conf.pedidos.lojas.endereco}</p>}
                      </div>
                    )}

                    {conf.observacoes && (
                      <p className="text-sm text-muted-foreground mb-3 italic">
                        📝 {conf.observacoes}
                      </p>
                    )}

                    {divergencias.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium text-destructive">
                          {divergencias.length} divergência(s) encontrada(s)
                        </span>
                      </div>
                    )}

                    {itemsForConf.length > 0 && divergencias.length === 0 && (
                      <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-accent border border-border">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Tudo conferido sem divergências ✓</span>
                      </div>
                    )}

                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-xs text-center">Qtd Pedida</TableHead>
                            <TableHead className="text-xs text-center">Qtd Recebida</TableHead>
                            <TableHead className="text-xs text-right">Preço Cotado</TableHead>
                            <TableHead className="text-xs text-right">Preço NF</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemsForConf.map((item) => {
                            const hasDivItem = item.divergencia_qtd || item.divergencia_preco;
                            return (
                              <TableRow key={item.id} className={hasDivItem ? "bg-destructive/5" : ""}>
                                <TableCell className="text-xs font-medium">
                                  {item.produto_nome}
                                  {item.embalagem && (
                                    <span className="text-muted-foreground ml-1">({item.embalagem})</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-center">{item.quantidade_pedida}</TableCell>
                                <TableCell className={cn("text-xs text-center font-medium", item.divergencia_qtd && "text-destructive")}>
                                  {item.quantidade_recebida}
                                </TableCell>
                                <TableCell className="text-xs text-right">{formatBRL(item.preco_cotado)}</TableCell>
                                <TableCell className={cn("text-xs text-right font-medium", item.divergencia_preco && "text-destructive")}>
                                  {formatBRL(item.preco_nf)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {hasDivItem ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                                      Divergência
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 border-primary/30 text-primary">
                                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                      OK
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConferenciasPage;
