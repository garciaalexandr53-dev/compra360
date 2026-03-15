import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, User, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ConferenciaRow {
  id: string;
  created_at: string;
  conferido_por: string;
  observacoes: string | null;
  pedido_id: string;
  pedidos: {
    numero: number;
    total: number | null;
    fornecedores: { nome: string };
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

  const { data: conferencias = [], isLoading } = useQuery({
    queryKey: ["conferencias-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conferencias")
        .select("id, created_at, conferido_por, observacoes, pedido_id, pedidos(numero, total, fornecedores(nome))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ConferenciaRow[]) || [];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["conferencia-itens", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conferencia_itens")
        .select("*")
        .eq("conferencia_id", expandedId!);
      if (error) throw error;
      return (data as ConferenciaItem[]) || [];
    },
  });

  const totalConferencias = conferencias.length;
  const comDivergencia = conferencias.filter((c) => c.id).length; // We'll compute from items below
  
  // Stats
  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Histórico de Conferências
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todas as conferências de pedidos realizadas pelos funcionários
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalConferencias}</p>
              <p className="text-xs text-muted-foreground">Conferências realizadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {conferencias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma conferência realizada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conferencias.map((conf) => {
            const isExpanded = expandedId === conf.id;
            const divergencias = isExpanded
              ? itens.filter((i) => i.divergencia_qtd || i.divergencia_preco)
              : [];

            return (
              <Card key={conf.id} className="overflow-hidden">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggle(conf.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="h-4 w-4 text-primary" />
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
                      {conf.total && (
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

                    {itens.length === 0 && divergencias.length === 0 && (
                      <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Carregando itens...</span>
                      </div>
                    )}

                    {itens.length > 0 && divergencias.length === 0 && (
                      <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Tudo conferido sem divergências ✓</span>
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
                          {itens.map((item) => {
                            const hasDivergence = item.divergencia_qtd || item.divergencia_preco;
                            return (
                              <TableRow
                                key={item.id}
                                className={hasDivergence ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                              >
                                <TableCell className="text-xs font-medium">
                                  {item.produto_nome}
                                  {item.embalagem && (
                                    <span className="text-muted-foreground ml-1">({item.embalagem})</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-center">{item.quantidade_pedida}</TableCell>
                                <TableCell className={`text-xs text-center font-medium ${item.divergencia_qtd ? "text-destructive" : ""}`}>
                                  {item.quantidade_recebida}
                                </TableCell>
                                <TableCell className="text-xs text-right">{formatBRL(item.preco_cotado)}</TableCell>
                                <TableCell className={`text-xs text-right font-medium ${item.divergencia_preco ? "text-destructive" : ""}`}>
                                  {formatBRL(item.preco_nf)}
                                </TableCell>
                                <TableCell className="text-center">
                                  {hasDivergence ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" />
                                      Divergência
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 border-green-500 text-green-600">
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
