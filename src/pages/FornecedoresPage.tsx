import { useState, useEffect } from "react";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Copy, ExternalLink, RefreshCw, Link2, Users, Search } from "lucide-react";
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
  const { lojaAtiva } = useLojaAtiva();
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
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  // Links tab data
  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("id").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
  });

  const { data: respondidos = new Set<string>() } = useQuery({
    queryKey: ["respondidos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return new Set<string>();
      const cpIds = cps.map((cp) => cp.id);
      const { data: precos } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      return new Set((precos || []).map((p) => p.fornecedor_id));
    },
  });

  const { data: precoCounts = {} as Record<string, number> } = useQuery({
    queryKey: ["preco-counts", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return {};
      const cpIds = cps.map((cp) => cp.id);
      const { data: precos } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", cpIds).not("preco", "is", null);
      const counts: Record<string, number> = {};
      (precos || []).forEach((p) => { counts[p.fornecedor_id] = (counts[p.fornecedor_id] || 0) + 1; });
      return counts;
    },
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: async (fornecedorId: string) => {
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase.from("fornecedores").update({ token: newToken }).eq("id", fornecedorId);
      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Novo link gerado!");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TablesInsert<"fornecedores"> | { id: string } & TablesUpdate<"fornecedores">) => {
      let fId = editingId;
      if (editingId) {
        const { error } = await supabase.from("fornecedores").update({
          nome: data.nome, representante: (data as any).representante || null,
          telefone: (data as any).telefone || null, email: (data as any).email || null,
          pedido_minimo: (data as any).pedido_minimo || 0, prazo_pagamento: (data as any).prazo_pagamento || null,
          observacoes: (data as any).observacoes || null,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("fornecedores").insert({
          nome: data.nome!, representante: (data as any).representante || null,
          telefone: (data as any).telefone || null, email: (data as any).email || null,
          pedido_minimo: (data as any).pedido_minimo || 0, prazo_pagamento: (data as any).prazo_pagamento || null,
          observacoes: (data as any).observacoes || null,
        }).select("id").single();
        if (error) throw error;
        fId = inserted.id;
      }
      if (fId) {
        await supabase.from("fornecedor_lojas").delete().eq("fornecedor_id", fId);
        if (selectedLojas.length > 0) {
          await supabase.from("fornecedor_lojas").insert(selectedLojas.map((lId) => ({ fornecedor_id: fId!, loja_id: lId })));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      queryClient.invalidateQueries({ queryKey: ["fornecedor-lojas"] });
      setModalOpen(false); setEditingId(null); setForm(emptyForm);
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor adicionado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fornecedores"] }); toast.success("Fornecedor removido!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setSelectedLojas([]); setModalOpen(true); };

  const openEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setForm({
      nome: f.nome, representante: f.representante || "", telefone: f.telefone || "",
      email: f.email || "", pedido_minimo: f.pedido_minimo?.toString() || "",
      prazo_pagamento: (f as any).prazo_pagamento || "", observacoes: f.observacoes || "",
    });
    setSelectedLojas(fornecedorLojas.filter((fl: any) => fl.fornecedor_id === f.id).map((fl: any) => fl.loja_id));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Digite o nome do fornecedor"); return; }
    await saveMutation.mutateAsync({
      nome: form.nome.trim().toUpperCase(), representante: form.representante.trim() || null,
      telefone: form.telefone.trim() || null, email: form.email.trim() || null,
      pedido_minimo: parseFloat(form.pedido_minimo) || 0, prazo_pagamento: form.prazo_pagamento.trim() || null,
      observacoes: form.observacoes.trim() || null,
    } as any);
  };

  const getLink = (f: Fornecedor) => {
    const base = `${window.location.origin}/fornecedor/${f.token}`;
    return lojaAtiva?.id ? `${base}?loja=${lojaAtiva.id}` : base;
  };

  const copyLink = (f: Fornecedor) => { navigator.clipboard.writeText(getLink(f)); toast.success("Link copiado!"); };

  const openWhatsApp = (f: Fornecedor) => {
    const link = getLink(f);
    const msg = `Olá ${f.nome}! Segue o link para preencher os preços da cotação:\n${link}\n\nPreencha os preços e envie. Obrigado!`;
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const showLink = (f: Fornecedor) => { setSelectedFornecedor(f); setLinkModalOpen(true); };

  const getLojaNames = (fId: string) => {
    const lojaIds = fornecedorLojas.filter((fl: any) => fl.fornecedor_id === fId).map((fl: any) => fl.loja_id);
    return lojas.filter((l: any) => lojaIds.includes(l.id)).map((l: any) => l.nome);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">{fornecedores.length} fornecedor{fornecedores.length !== 1 ? "es" : ""}</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      </div>

      <Tabs defaultValue="cadastro" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="cadastro" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Cadastro
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Links de Cotação
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab Cadastro ===== */}
        <TabsContent value="cadastro">
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Fornecedor</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Pedido Mín.</TableHead>
                    <TableHead>Lojas</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
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
                  ) : fornecedores.map((f) => {
                    const lojaNames = getLojaNames(f.id);
                    return (
                      <TableRow key={f.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openEdit(f)}>
                        <TableCell>
                          <div className="font-bold text-foreground">{f.nome}</div>
                          {f.observacoes && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{f.observacoes}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{f.representante || "-"}</TableCell>
                        <TableCell>
                          {f.telefone && <span className="text-primary text-sm block" onClick={(e) => e.stopPropagation()}><a href={`tel:${f.telefone}`} className="hover:underline">{f.telefone}</a></span>}
                          {f.email && <span className="text-muted-foreground text-xs block" onClick={(e) => e.stopPropagation()}><a href={`mailto:${f.email}`} className="hover:underline">{f.email}</a></span>}
                          {!f.telefone && !f.email && <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            f.pedido_minimo && f.pedido_minimo > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                          }`}>
                            {f.pedido_minimo && f.pedido_minimo > 0 ? formatBRL(f.pedido_minimo) : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {lojaNames.length > 0 ? lojaNames.map((name, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-accent rounded text-accent-foreground">{name}</span>
                            )) : <span className="text-xs text-muted-foreground">Todas</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showLink(f)} title="Ver link">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                              if (confirm(`Remover "${f.nome}" e todos os preços dele?`)) deleteMutation.mutate(f.id);
                            }} title="Remover">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ===== Tab Links ===== */}
        <TabsContent value="links">
          <div className="bg-card border rounded-xl p-4 mb-4 shadow-sm">
            <p className="text-sm text-muted-foreground leading-relaxed">
              📱 Envie o link ao fornecedor. Ele abre no celular, preenche os preços e envia.
              Os preços são importados automaticamente na sua cotação em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fornecedores.map((f) => {
              const recv = respondidos instanceof Set ? respondidos.has(f.id) : false;
              const count = precoCounts[f.id] || 0;
              return (
                <div
                  key={f.id}
                  className={`bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
                    recv ? "border-l-[3px] border-l-green-500" : ""
                  }`}
                  onClick={() => showLink(f)}
                >
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{f.nome}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      recv ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {recv ? "✓ Recebido" : "Aguardando"}
                    </span>
                  </div>

                  {recv && (
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Preços enviados</span>
                      <span className="font-bold text-green-700">{count}</span>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={(e) => { e.stopPropagation(); copyLink(f); }}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs" onClick={(e) => { e.stopPropagation(); openWhatsApp(f); }}>
                      📱 WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {fornecedores.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum fornecedor cadastrado. Adicione na aba "Cadastro".
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "✏️ Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
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
            </div>
            <div><Label>Prazo de Pagamento</Label><Input placeholder="Ex: 30 dias, à vista, 7/14/21" value={form.prazo_pagamento} onChange={(e) => setForm({ ...form, prazo_pagamento: e.target.value })} /></div>
            <div><Label>Observações</Label><Input placeholder="Ex: entrega 3x por semana" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            {lojas.length > 0 && (
              <div>
                <Label>Lojas atendidas</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lojas.map((l: any) => (
                    <label key={l.id} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer text-sm transition-colors ${selectedLojas.includes(l.id) ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/30"}`}>
                      <Checkbox checked={selectedLojas.includes(l.id)} onCheckedChange={(checked) => {
                        setSelectedLojas(checked ? [...selectedLojas, l.id] : selectedLojas.filter((x: string) => x !== l.id));
                      }} />
                      {l.nome}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Selecione quais lojas este fornecedor atende</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔗 Link — {selectedFornecedor?.nome}</DialogTitle>
          </DialogHeader>
          {selectedFornecedor && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Compartilhe com o fornecedor para que ele preencha os preços.</p>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">{getLink(selectedFornecedor)}</div>
              <Button variant="outline" className="w-full" onClick={() => window.open(getLink(selectedFornecedor), "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir link direto
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => copyLink(selectedFornecedor)} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" /> Copiar link
                </Button>
                <Button onClick={() => openWhatsApp(selectedFornecedor)} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  📱 WhatsApp
                </Button>
              </div>
              <Button variant="outline" className="w-full text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => {
                regenerateTokenMutation.mutate(selectedFornecedor.id);
                setLinkModalOpen(false);
              }}>
                <RefreshCw className="h-4 w-4 mr-2" /> Gerar novo link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedoresPage;
