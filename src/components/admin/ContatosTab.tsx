import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Mail, X, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Cliente, MOTIVO_LABEL, MotivoContato } from "@/lib/adminHelpers";

type ContatoRow = {
  id: string;
  user_id: string;
  canal: "whatsapp" | "email";
  motivo: MotivoContato;
  observacao: string | null;
  created_at: string;
  cliente_nome: string | null;
  cliente_email: string | null;
  total_count: number;
};

interface Props {
  clientes: Cliente[] | undefined;
  onSelectCliente?: (userId: string) => void;
}

const PAGE_SIZE = 50;

export default function ContatosTab({ clientes, onSelectCliente }: Props) {
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroCanal, setFiltroCanal] = useState<"todos" | "whatsapp" | "email">("todos");
  const [filtroMotivo, setFiltroMotivo] = useState<"todos" | MotivoContato>("todos");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filtroCliente, filtroCanal, filtroMotivo, debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-contatos", filtroCliente, filtroCanal, filtroMotivo, debouncedSearch, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_contatos", {
        _user_id: filtroCliente === "todos" ? null : filtroCliente,
        _canal: filtroCanal === "todos" ? null : filtroCanal,
        _motivo: filtroMotivo === "todos" ? null : filtroMotivo,
        _search: debouncedSearch || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data || []) as ContatoRow[];
    },
    placeholderData: keepPreviousData,
  });

  const rows = data || [];
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  const temFiltro =
    filtroCliente !== "todos" || filtroCanal !== "todos" || filtroMotivo !== "todos" || search.trim() !== "";

  const clientesOrdenados = useMemo(
    () =>
      [...(clientes || [])].sort((a, b) =>
        (a.loja_principal || a.email).localeCompare(b.loja_principal || b.email),
      ),
    [clientes],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Histórico de contatos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filtroCliente} onValueChange={setFiltroCliente}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientesOrdenados.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.loja_principal || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroCanal} onValueChange={(v) => setFiltroCanal(v as typeof filtroCanal)}>
            <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroMotivo} onValueChange={(v) => setFiltroMotivo(v as typeof filtroMotivo)}>
            <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motivos</SelectItem>
              <SelectItem value="trial_expirando">{MOTIVO_LABEL.trial_expirando}</SelectItem>
              <SelectItem value="risco_churn">{MOTIVO_LABEL.risco_churn}</SelectItem>
              <SelectItem value="sem_ativacao">{MOTIVO_LABEL.sem_ativacao}</SelectItem>
              <SelectItem value="manual">{MOTIVO_LABEL.manual}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {Number(total)} {Number(total) === 1 ? "contato" : "contatos"}
          </div>
          {temFiltro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiltroCliente("todos");
                setFiltroCanal("todos");
                setFiltroMotivo("todos");
                setSearch("");
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum contato registrado{temFiltro ? " com esses filtros" : ""}.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((c) => {
              const nome = c.cliente_nome || c.cliente_email || "Cliente removido";
              const Icon = c.canal === "whatsapp" ? MessageCircle : Mail;
              return (
                <div
                  key={c.id}
                  className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:w-16 sm:pt-1 shrink-0">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        c.canal === "whatsapp"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {onSelectCliente ? (
                        <button
                          type="button"
                          onClick={() => onSelectCliente(c.user_id)}
                          className="font-medium text-sm truncate text-left hover:underline hover:text-primary transition-colors"
                        >
                          {nome}
                        </button>
                      ) : (
                        <span className="font-medium text-sm truncate">{nome}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {MOTIVO_LABEL[c.motivo]}
                      </Badge>
                    </div>
                    {c.cliente_email && c.cliente_nome && (
                      <div className="text-xs text-muted-foreground truncate">{c.cliente_email}</div>
                    )}
                    {c.observacao && (
                      <div className="text-sm mt-1 text-foreground/80 whitespace-pre-wrap break-words">
                        {c.observacao}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap pt-1">
                    {formatDate(c.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
