import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Mail, CheckCircle2, XCircle, ShieldOff, Clock, RefreshCw, Download, FileSpreadsheet } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

const EXPORT_TZ = "America/Sao_Paulo";
const formatDateExport = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: EXPORT_TZ,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type Range = "24h" | "7d" | "30d";

const RANGE_MS: Record<Range, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const PAGE_SIZE = 50;

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  total_count: number;
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "sent")
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" />Enviado</Badge>;
  if (s === "pending")
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  if (s === "suppressed")
    return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/20 gap-1"><ShieldOff className="h-3 w-3" />Suprimido</Badge>;
  if (["failed", "dlq", "bounced", "complained"].includes(s))
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-500/20 gap-1"><XCircle className="h-3 w-3" />{s === "dlq" ? "Falhou (DLQ)" : s === "bounced" ? "Bounce" : s === "complained" ? "Reclamação" : "Falhou"}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function EmailsTab() {
  const [range, setRange] = useState<Range>("7d");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { start, end } = useMemo(() => {
    const now = new Date();
    return {
      end: now.toISOString(),
      start: new Date(now.getTime() - RANGE_MS[range]).toISOString(),
    };
  }, [range]);

  const filters = { start, end, template: template === "all" ? null : template, status: status === "all" ? null : status };

  const { data: templates = [] } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_email_template_names" as any);
      if (error) throw error;
      return (data || []) as { template_name: string }[];
    },
  });

  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-email-stats", filters.start, filters.end, filters.template],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_email_stats" as any, {
        _start: filters.start, _end: filters.end, _template: filters.template,
      });
      if (error) throw error;
      return data as { total?: number; sent?: number; pending?: number; failed?: number; suppressed?: number; complained?: number };
    },
  });

  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["admin-email-logs", filters.start, filters.end, filters.template, filters.status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_email_logs" as any, {
        _start: filters.start, _end: filters.end,
        _template: filters.template, _status: filters.status,
        _limit: PAGE_SIZE, _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data || []) as LogRow[];
    },
  });

  const total = logs?.[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  const refresh = () => { refetchStats(); refetchLogs(); };

  const [exporting, setExporting] = useState<false | "csv" | "xlsx">(false);

  const fetchAllFiltered = async (): Promise<LogRow[]> => {
    const BATCH = 1000;
    let offset = 0;
    const all: LogRow[] = [];
    while (true) {
      const { data, error } = await supabase.rpc("admin_list_email_logs" as any, {
        _start: filters.start, _end: filters.end,
        _template: filters.template, _status: filters.status,
        _limit: BATCH, _offset: offset,
      });
      if (error) throw error;
      const rows = (data || []) as LogRow[];
      all.push(...rows);
      if (rows.length < BATCH) break;
      offset += BATCH;
      if (offset > 50000) break; // safety cap
    }
    return all;
  };

  const buildStamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const handleExportCsv = async () => {
    setExporting("csv");
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) {
        toast({ title: "Nada para exportar", description: "Nenhum e-mail nos filtros atuais." });
        return;
      }

      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Data", "Template", "Destinatário", "Status", "Message ID", "Erro"];
      const lines = [header.join(";")];
      for (const r of all) {
        lines.push([
          formatDateExport(r.created_at),
          r.template_name,
          r.recipient_email,
          r.status,
          r.message_id ?? "",
          r.error_message ?? "",
        ].map(esc).join(";"));
      }
      const csv = "\uFEFF" + lines.join("\r\n"); // BOM for Excel pt-BR

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `email-logs-${range}-${buildStamp()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Exportação concluída", description: `${all.length} e-mails exportados.` });
    } catch (e) {
      toast({ title: "Erro ao exportar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    setExporting("xlsx");
    try {
      const all = await fetchAllFiltered();
      if (all.length === 0) {
        toast({ title: "Nada para exportar", description: "Nenhum e-mail nos filtros atuais." });
        return;
      }

      const rows = all.map((r) => ({
        Data: formatDateExport(r.created_at),
        Template: r.template_name,
        "Destinatário": r.recipient_email,
        Status: r.status,
        "Message ID": r.message_id ?? "",
        Erro: r.error_message ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 22 }, { wch: 22 }, { wch: 32 }, { wch: 14 }, { wch: 36 }, { wch: 50 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "E-mails");
      XLSX.writeFile(wb, `email-logs-${range}-${buildStamp()}.xlsx`);

      toast({ title: "Exportação concluída", description: `${all.length} e-mails exportados.` });
    } catch (e) {
      toast({ title: "Erro ao exportar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="inline-flex rounded-md border bg-card p-0.5">
            {(["24h", "7d", "30d"] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => { setRange(r); setPage(0); }}
              >
                {r === "24h" ? "24h" : r === "7d" ? "7 dias" : "30 dias"}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!!exporting || loadingLogs}
            className="h-8"
          >
            {exporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Download className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXlsx}
            disabled={!!exporting || loadingLogs}
            className="h-8"
          >
            {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <FileSpreadsheet className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Exportar XLSX</span>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Select value={template} onValueChange={(v) => { setTemplate(v); setPage(0); }}>
            <SelectTrigger className="h-9 sm:w-56"><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os templates</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.template_name} value={t.template_name}>{t.template_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="h-9 sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="dlq">Falhou (DLQ)</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="bounced">Bounce</SelectItem>
              <SelectItem value="suppressed">Suprimido</SelectItem>
              <SelectItem value="complained">Reclamação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats?.total ?? 0} loading={loadingStats} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Enviados" value={stats?.sent ?? 0} loading={loadingStats} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Falhas" value={(stats?.failed ?? 0)} loading={loadingStats} tone="danger" icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Suprimidos" value={stats?.suppressed ?? 0} loading={loadingStats} tone="warning" icon={<ShieldOff className="h-4 w-4" />} />
      </div>

      {/* Logs */}
      <Card>
        <CardContent className="p-0">
          {loadingLogs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !logs || logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum e-mail encontrado para os filtros atuais.</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {logs.map((row) => (
                  <div key={row.id} className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium truncate">{row.template_name}</span>
                      {statusBadge(row.status)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{row.recipient_email}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(row.created_at)}</div>
                    {row.error_message && (
                      <div className="text-[11px] text-red-600 dark:text-red-400 break-words">{row.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.template_name}</TableCell>
                        <TableCell className="text-sm">{row.recipient_email}</TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.created_at)}</TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate" title={row.error_message ?? ""}>
                          {row.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages} · {Number(total)} e-mails
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, loading, tone, icon,
}: {
  label: string; value: number; loading?: boolean;
  tone?: "success" | "danger" | "warning"; icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "danger"  ? "text-red-600 dark:text-red-400" :
    tone === "warning" ? "text-yellow-600 dark:text-yellow-400" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={toneClass}>{icon}</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${toneClass}`}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : Number(value).toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
