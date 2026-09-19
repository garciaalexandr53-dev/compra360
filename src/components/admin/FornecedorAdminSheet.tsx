import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, buildWhatsAppUrl } from "@/lib/format";
import { TIPOS_FORNECEDOR, PASTAS_FORNECEDOR } from "@/lib/adminHelpers";
import { maskTelefone, formatTelefone } from "@/lib/masks";
import type { FornecedorAdmin } from "@/lib/adminExports";
import { formatNomeEmpresa, formatNomePessoa, formatNomeLoja } from "@/lib/masks";

type Detalhes = {
  id?: string;
  nome?: string;
  representante?: string | null;
  telefone?: string | null;
  email?: string | null;
  pedido_minimo?: number | null;
  prazo_pagamento?: string | null;
  observacoes?: string | null;
  tipo_fornecedor?: string | null;
  pasta?: string[] | null;
  created_at?: string;
  cliente_nome?: string | null;
  cliente_empresa?: string | null;
  cliente_email?: string | null;
  lojas?: { id: string; nome: string; cidade: string | null; uf: string | null }[];
  cotacoes_recebidas?: number;
  cotacoes_respondidas?: number;
  ultima_resposta_at?: string | null;
};

type Form = {
  nome: string;
  representante: string;
  telefone: string;
  email: string;
  pedido_minimo: string;
  prazo_pagamento: string;
  observacoes: string;
  tipo_fornecedor: string;
  pasta: string[];
};

const VAZIO: Form = {
  nome: "", representante: "", telefone: "", email: "",
  pedido_minimo: "", prazo_pagamento: "", observacoes: "",
  tipo_fornecedor: "", pasta: [],
};

const SEM_TIPO = "__sem_tipo__";

export default function FornecedorAdminSheet({
  fornecedor, onClose, onSaved,
}: {
  fornecedor: FornecedorAdmin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const { data: detalhes, isLoading } = useQuery({
    queryKey: ["admin-fornecedor-detalhes", fornecedor?.id],
    enabled: !!fornecedor?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_fornecedor_detalhes", {
        _fornecedor_id: fornecedor!.id,
      });
      if (error) throw error;
      return (data || {}) as Detalhes;
    },
  });

  useEffect(() => {
    if (!detalhes?.id) return;
    setForm({
      nome: detalhes.nome ?? "",
      representante: detalhes.representante ?? "",
      telefone: formatTelefone(detalhes.telefone ?? ""),
      email: detalhes.email ?? "",
      pedido_minimo: detalhes.pedido_minimo != null ? String(detalhes.pedido_minimo) : "",
      prazo_pagamento: detalhes.prazo_pagamento ?? "",
      observacoes: detalhes.observacoes ?? "",
      tipo_fornecedor: detalhes.tipo_fornecedor ?? "",
      pasta: detalhes.pasta ?? [],
    });
  }, [detalhes?.id, detalhes]);

  const salvar = async () => {
    if (!fornecedor) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do fornecedor", variant: "destructive" });
      return;
    }
    const pedidoMinimo = form.pedido_minimo.trim()
      ? Number(form.pedido_minimo.replace(",", "."))
      : null;
    if (pedidoMinimo !== null && (Number.isNaN(pedidoMinimo) || pedidoMinimo < 0)) {
      toast({ title: "Pedido mínimo inválido", variant: "destructive" });
      return;
    }

    setSalvando(true);
    const { error } = await supabase.rpc("admin_update_fornecedor", {
      _fornecedor_id: fornecedor.id,
      _nome: formatNomeEmpresa(form.nome),
      _representante: formatNomePessoa(form.representante) || null,
      _telefone: form.telefone.trim() || null,
      _email: form.email.trim() || null,
      _pedido_minimo: pedidoMinimo,
      _prazo_pagamento: form.prazo_pagamento.trim() || null,
      _observacoes: form.observacoes.trim() || null,
      _tipo_fornecedor: form.tipo_fornecedor || null,
      _pasta: form.tipo_fornecedor === "especializado" && form.pasta.length ? form.pasta : null,
    });
    setSalvando(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fornecedor atualizado", description: form.nome.trim() });
    onSaved();
    onClose();
  };

  return (
    <Sheet open={!!fornecedor} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="break-words pr-6">{fornecedor?.nome || "Fornecedor"}</SheetTitle>
          <SheetDescription>
            Cadastro de {detalhes?.cliente_empresa || detalhes?.cliente_nome || detalhes?.cliente_email || "cliente"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5 py-4">
            {/* Atividade */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Atividade</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Cotações recebidas</p>
                  <p className="font-medium">{detalhes?.cotacoes_recebidas ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cotações respondidas</p>
                  <p className="font-medium">{detalhes?.cotacoes_respondidas ?? 0}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Última resposta: {detalhes?.ultima_resposta_at ? formatDateTime(detalhes.ultima_resposta_at) : "nunca respondeu"}
              </p>
              {detalhes?.created_at && (
                <p className="text-xs text-muted-foreground">Cadastrado em {formatDate(detalhes.created_at)}</p>
              )}
            </div>

            {/* Lojas vinculadas */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase">Lojas vinculadas</p>
              {detalhes?.lojas?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {detalhes.lojas.map((l) => (
                    <Badge key={l.id} variant="secondary" className="text-[11px]">
                      {formatNomeLoja(l.nome)}{l.cidade ? ` · ${l.cidade}${l.uf ? `/${l.uf}` : ""}` : ""}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Atende todas as lojas do cliente.</p>
              )}
            </div>

            {/* Formulário */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Dados de contato</p>
              <div className="space-y-1.5">
                <Label htmlFor="forn-nome">Fornecedor</Label>
                <Input id="forn-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-rep">Representante</Label>
                <Input id="forn-rep" value={form.representante} onChange={(e) => setForm({ ...form, representante: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-tel">Telefone / WhatsApp</Label>
                <Input
                  id="forn-tel"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-email">E-mail</Label>
                <Input id="forn-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="forn-min">Pedido mínimo (R$)</Label>
                  <Input id="forn-min" inputMode="decimal" value={form.pedido_minimo} onChange={(e) => setForm({ ...form, pedido_minimo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forn-prazo">Prazo de pagamento</Label>
                  <Input id="forn-prazo" value={form.prazo_pagamento} onChange={(e) => setForm({ ...form, prazo_pagamento: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forn-tipo">Tipo de fornecedor</Label>
                <Select
                  value={form.tipo_fornecedor || SEM_TIPO}
                  onValueChange={(v) =>
                    setForm((prev) => {
                      const tipo = v === SEM_TIPO ? "" : v;
                      return { ...prev, tipo_fornecedor: tipo, pasta: tipo === "especializado" ? prev.pasta : [] };
                    })
                  }
                >
                  <SelectTrigger id="forn-tipo"><SelectValue placeholder="Não definido" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_TIPO}>Não definido</SelectItem>
                    {TIPOS_FORNECEDOR.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.tipo_fornecedor === "especializado" && (
                <div className="space-y-1.5">
                  <Label>Pastas atendidas</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PASTAS_FORNECEDOR.map((p) => {
                      const ativo = form.pasta.includes(p);
                      return (
                        <Button
                          key={p}
                          type="button"
                          size="sm"
                          variant={ativo ? "default" : "outline"}
                          aria-pressed={ativo}
                          className="h-7 text-xs"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              pasta: ativo ? prev.pasta.filter((x) => x !== p) : [...prev.pasta, p],
                            }))
                          }
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  {form.pasta.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nenhuma pasta selecionada.</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="forn-obs">Observações</Label>
                <Textarea id="forn-obs" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {form.telefone.trim() && (
                <Button variant="outline" asChild>
                  <a href={buildWhatsAppUrl(form.telefone, "")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
                  </a>
                </Button>
              )}
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
