import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  admin_id: string;
};

interface Props {
  clientes: Cliente[] | undefined;
}

export default function ContatosTab({ clientes }: Props) {
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroCanal, setFiltroCanal] = useState<"todos" | "whatsapp" | "email">("todos");
  const [filtroMotivo, setFiltroMotivo] = useState<"todos" | MotivoContato>("todos");
  const [search, setSearch] = useState("");

  const { data: contatos, isLoading } = useQuery({
    queryKey: ["admin-contatos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_contatos")
        .select("id, user_id, canal, motivo, observacao, created_at, admin_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ContatoRow[];
    },
  });

  const clienteMap = useMemo(() => {
    const m = new Map<string, Cliente>();
    (clientes || []).forEach((c) => m.set(c.user_id, c));
    return m;
  }, [clientes]);

  const filtrados = useMemo(() => {
    return (contatos || []).filter((c) => {
      if (filtroCliente !== "todos" && c.user_id !== filtroCliente) return false;
      if (filtroCanal !== "todos" && c.canal !== filtroCanal) return false;
      if (filtroMotivo !== "todos" && c.motivo !== filtroMotivo) return false;
      if (search.trim()) {
        const cli = clienteMap.get(c.user_id);
        const hay = `${cli?.loja_principal || ""} ${cli?.email || ""} ${c.observacao || ""}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [contatos, filtroCliente, filtroCanal, filtroMotivo, search, clienteMap]);

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
          <div className="text-sm text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? "contato" : "contatos"}
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
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum contato registrado{temFiltro ? " com esses filtros" : ""}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((c) => {
              const cli = clienteMap.get(c.user_id);
              const nome = cli?.loja_principal || cli?.email || "Cliente removido";
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
                      <span className="font-medium text-sm truncate">{nome}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {MOTIVO_LABEL[c.motivo]}
                      </Badge>
                    </div>
                    {cli?.email && cli.loja_principal && (
                      <div className="text-xs text-muted-foreground truncate">{cli.email}</div>
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
      </CardContent>
    </Card>
  );
}
