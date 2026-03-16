import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

const emptyForm = {
  nome: "",
  representante: "",
  telefone: "",
  email: "",
  pedido_minimo: "",
  prazo_pagamento: "",
  observacoes: "",
};

const FornecedoresPage = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([]);

  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedorLojas = [] } = useQuery({
    queryKey: ["fornecedor-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedor_lojas").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TablesInsert<"fornecedores"> | { id: string } & TablesUpdate<"fornecedores">) => {
      if (editingId) {
        const { error } = await supabase.from("fornecedores").update({
          nome: data.nome,
          representante: (data as any).representante || null,
          telefone: (data as any).telefone || null,
          email: (data as any).email || null,
          pedido_minimo: (data as any).pedido_minimo || 0,
          prazo_pagamento: (data as any).prazo_pagamento || null,
          observacoes: (data as any).observacoes || null,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert({
          nome: data.nome!,
          representante: (data as any).representante || null,
          telefone: (data as any).telefone || null,
          email: (data as any).email || null,
          pedido_minimo: (data as any).pedido_minimo || 0,
          prazo_pagamento: (data as any).prazo_pagamento || null,
          observacoes: (data as any).observacoes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setForm({
      nome: f.nome,
      representante: f.representante || "",
      telefone: f.telefone || "",
      email: f.email || "",
      pedido_minimo: f.pedido_minimo?.toString() || "",
      prazo_pagamento: (f as any).prazo_pagamento || "",
      observacoes: f.observacoes || "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) { toast.error("Digite o nome do fornecedor"); return; }
    saveMutation.mutate({
      nome: form.nome.trim().toUpperCase(),
      representante: form.representante.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      pedido_minimo: parseFloat(form.pedido_minimo) || 0,
      prazo_pagamento: form.prazo_pagamento.trim() || null,
      observacoes: form.observacoes.trim() || null,
    } as any);
  };

  const getLink = (f: Fornecedor) => {
    return `${window.location.origin}/fornecedor/${f.token}`;
  };

  const copyLink = (f: Fornecedor) => {
    navigator.clipboard.writeText(getLink(f));
    toast.success("Link copiado!");
  };

  const openWhatsApp = (f: Fornecedor) => {
    const link = getLink(f);
    const msg = `Olá ${f.nome}! Segue o link para preencher os preços da cotação:\n${link}\n\nPreencha os preços e envie. Obrigado!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const showLink = (f: Fornecedor) => {
    setSelectedFornecedor(f);
    setLinkModalOpen(true);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Gestão de Fornecedores</h1>
          <p className="text-sm text-muted-foreground">{fornecedores.length} fornecedor{fornecedores.length !== 1 ? "es" : ""} cadastrado{fornecedores.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Fornecedor</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Pedido Mín.</TableHead>
                <TableHead>Obs.</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : fornecedores.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum fornecedor cadastrado.
                  <br />
                  <Button onClick={openAdd} variant="outline" size="sm" className="mt-3">+ Adicionar primeiro fornecedor</Button>
                </TableCell></TableRow>
              ) : fornecedores.map((f) => (
                <TableRow key={f.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-bold text-foreground">{f.nome}</div>
                    {f.representante && <div className="text-xs text-muted-foreground">{f.representante}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.representante || "-"}</TableCell>
                  <TableCell>
                    {f.telefone && <a href={`tel:${f.telefone}`} className="text-primary text-sm hover:underline block">{f.telefone}</a>}
                    {f.email && <a href={`mailto:${f.email}`} className="text-muted-foreground text-xs hover:underline block">{f.email}</a>}
                    {!f.telefone && !f.email && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      f.pedido_minimo && f.pedido_minimo > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {f.pedido_minimo && f.pedido_minimo > 0 ? formatBRL(f.pedido_minimo) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{f.observacoes || ""}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showLink(f)} title="Ver link">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm(`Remover "${f.nome}" e todos os preços dele?`)) deleteMutation.mutate(f.id);
                      }} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Fornecedor *</Label>
              <Input placeholder="Ex: COLUMBIA" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Representante</Label><Input placeholder="Nome" value={form.representante} onChange={(e) => setForm({ ...form, representante: e.target.value })} /></div>
              <div><Label>Telefone / WhatsApp</Label><Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div><Label>E-mail</Label><Input type="email" placeholder="email@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <Label>Pedido Mínimo (R$)</Label>
              <Input type="number" placeholder="0.00" min="0" step="0.01" value={form.pedido_minimo} onChange={(e) => setForm({ ...form, pedido_minimo: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Deixe 0 ou vazio se não houver mínimo</p>
            </div>
            <div>
              <Label>Prazo de Pagamento</Label>
              <Input placeholder="Ex: 30 dias, à vista, 7/14/21" value={form.prazo_pagamento} onChange={(e) => setForm({ ...form, prazo_pagamento: e.target.value })} />
            </div>
            <div><Label>Observações</Label><Input placeholder="Ex: entrega 3x por semana" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              {saveMutation.isPending ? "Salvando..." : "Salvar Fornecedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link — {selectedFornecedor?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Compartilhe com o fornecedor para que ele preencha os preços.</p>
          {selectedFornecedor && (
            <>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">{getLink(selectedFornecedor)}</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => copyLink(selectedFornecedor)} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" /> Copiar link
                </Button>
                <Button onClick={() => openWhatsApp(selectedFornecedor)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  📱 WhatsApp
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedoresPage;
