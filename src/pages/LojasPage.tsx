import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Store, Check } from "lucide-react";
import { toast } from "sonner";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const emptyForm = { nome: "", endereco: "", cnpj: "", razao_social: "", inscricao_estadual: "" };

const LojasPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, setLojaAtivaId } = useLojaAtiva();
  const { user } = useAuth();
  const { checkLimit, showPlanos, setShowPlanos } = useFeatureCheck();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        endereco: form.endereco || null,
        cnpj: form.cnpj || null,
        razao_social: form.razao_social || null,
        inscricao_estadual: form.inscricao_estadual || null,
      };
      if (editingId) {
        const { error } = await supabase.from("lojas").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lojas").insert({ ...payload, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      toast.success(editingId ? "Loja atualizada!" : "Loja cadastrada!");
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lojas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      toast.success("Loja removida!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    if (!checkLimit("max_lojas", lojas.length, "Faça upgrade para cadastrar mais lojas.")) return;
    setEditingId(null); setForm(emptyForm); setModalOpen(true);
  };
  const openEdit = (l: any) => {
    setEditingId(l.id);
    setForm({
      nome: l.nome,
      endereco: l.endereco || "",
      cnpj: l.cnpj || "",
      razao_social: l.razao_social || "",
      inscricao_estadual: l.inscricao_estadual || "",
    });
    setModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex justify-end mb-4">
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Loja
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground animate-pulse">Carregando...</div>
      ) : lojas.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-xl">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma loja cadastrada</p>
          <Button onClick={openAdd} className="mt-4" size="sm"><Plus className="h-4 w-4 mr-1" /> Cadastrar Loja</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {lojas.map((l: any) => {
            const isActive = lojaAtiva?.id === l.id;
            return (
              <div
                key={l.id}
                className={`bg-card border rounded-xl p-4 shadow-sm transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/5 shadow-primary/10"
                    : "hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => { setLojaAtivaId(l.id); toast.success(`Loja "${l.nome}" selecionada`); }}
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border"
                      }`}
                      title="Selecionar como loja ativa"
                    >
                      {isActive ? <Check className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-sm">{l.nome}</span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-bold">
                            ATIVA
                          </span>
                        )}
                      </div>
                      {l.razao_social && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{l.razao_social}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remover "${l.nome}"?`)) deleteMutation.mutate(l.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {(l.cnpj || l.endereco) && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    {l.cnpj && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground w-10 shrink-0">CNPJ</span>
                        <span>{l.cnpj}</span>
                      </div>
                    )}
                    {l.inscricao_estadual && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground w-10 shrink-0">IE</span>
                        <span>{l.inscricao_estadual}</span>
                      </div>
                    )}
                    {l.endereco && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground w-10 shrink-0">End.</span>
                        <span className="truncate">{l.endereco}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Loja" : "Nova Loja"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Loja *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Loja Centro" />
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} placeholder="Ex: Empresa LTDA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label>Inscrição Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Ex: Rua Principal, 100" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </div>
  );
};

export default LojasPage;
