import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Store, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useFeatureCheck } from "@/components/FeatureGate";
import PlanosModal from "@/components/PlanosModal";
import LojaCard from "@/components/lojas/LojaCard";
import LojaSheet from "@/components/lojas/LojaSheet";
import LojaEditModal from "@/components/lojas/LojaEditModal";
import { Loja, LojaForm, LojaMetrics, emptyLojaForm, getDisplayName } from "@/components/lojas/lojaUtils";

const LojasPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, setLojaAtivaId } = useLojaAtiva();
  const { user } = useAuth();
  const { checkLimit, showPlanos, setShowPlanos } = useFeatureCheck();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LojaForm>(emptyLojaForm);
  const [sheetLojaId, setSheetLojaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lojas").select("*").order("nome");
      if (error) throw error;
      return (data || []) as Loja[];
    },
  });

  // Restore sheet when user comes back from a destination page (Produtos, Fornecedores, etc.)
  useEffect(() => {
    if (lojas.length === 0) return;
    const id = sessionStorage.getItem("voltar_loja_id");
    if (id && lojas.some((l) => l.id === id)) {
      setSheetLojaId(id);
      sessionStorage.removeItem("voltar_loja_id");
    }
  }, [lojas]);

  // ===== Métricas em uma única bateria de queries (eficiente) =====
  const { data: metricsByLoja = {}, isLoading: loadingMetrics } = useQuery({
    queryKey: ["lojas-metrics", user?.id, lojas.map((l) => l.id).join(",")],
    enabled: !!user && lojas.length > 0,
    queryFn: async () => {
      const lojaIds = lojas.map((l) => l.id);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [fornLojas, cotacoesAll, produtos] = await Promise.all([
        supabase.from("fornecedor_lojas").select("loja_id, fornecedor_id").in("loja_id", lojaIds),
        supabase
          .from("cotacoes")
          .select("id, loja_id, status, created_at, finalizada_at")
          .in("loja_id", lojaIds)
          .order("created_at", { ascending: false }),
        supabase.from("produtos").select("id").eq("ativo", true).eq("user_id", user!.id),
      ]);

      const totalProdutosUser = produtos.data?.length ?? 0;

      const result: Record<string, LojaMetrics> = {};
      for (const lId of lojaIds) {
        const fornSet = new Set(
          (fornLojas.data || []).filter((fl) => fl.loja_id === lId).map((fl) => fl.fornecedor_id),
        );
        const cots = (cotacoesAll.data || []).filter((c) => c.loja_id === lId);
        const cotsMes = cots.filter(
          (c) => c.status === "finalizada" && c.finalizada_at && new Date(c.finalizada_at) >= inicioMes,
        );
        const ultima = cots[0];
        const ativa = cots.find((c) => c.status === "ativa");
        result[lId] = {
          produtosAtivos: totalProdutosUser, // produtos são por user, não por loja na tabela atual
          fornecedoresVinculados: fornSet.size,
          cotacoesMes: cotsMes.length,
          ultimaCotacaoAt: ultima?.created_at ?? null,
          ultimaCotacaoId: ultima?.id ?? null,
          cotacaoAtivaId: ativa?.id ?? null,
        };
      }
      return result;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: (form.nome.trim() || form.nome_fantasia.trim()),
        nome_fantasia: form.nome_fantasia.trim() || null,
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
      queryClient.invalidateQueries({ queryKey: ["lojas-metrics"] });
      toast.success(editingId ? "Loja atualizada!" : "Loja cadastrada!");
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyLojaForm);
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
      queryClient.invalidateQueries({ queryKey: ["lojas-metrics"] });
      toast.success("Loja removida!");
      setSheetLojaId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    if (!checkLimit("max_lojas", lojas.length, "Faça upgrade para cadastrar mais lojas.")) return;
    setEditingId(null);
    setForm(emptyLojaForm);
    setModalOpen(true);
  };

  const openEdit = (l: Loja) => {
    setSheetLojaId(null);
    setEditingId(l.id);
    setForm({
      nome: l.nome || "",
      nome_fantasia: l.nome_fantasia || "",
      endereco: l.endereco || "",
      cnpj: l.cnpj || "",
      razao_social: l.razao_social || "",
      inscricao_estadual: l.inscricao_estadual || "",
    });
    setModalOpen(true);
  };

  const handleActivate = (id: string) => {
    setLojaAtivaId(id);
    const l = lojas.find((x) => x.id === id);
    toast.success(`Loja "${getDisplayName(l!)}" ativada`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter((l) => {
      return (
        getDisplayName(l).toLowerCase().includes(q) ||
        l.razao_social?.toLowerCase().includes(q) ||
        l.cnpj?.toLowerCase().includes(q)
      );
    });
  }, [lojas, search]);

  const sheetLoja = sheetLojaId ? lojas.find((l) => l.id === sheetLojaId) ?? null : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-3 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-success">Lojas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lojas.length} {lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
            </p>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Nova Loja
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar loja, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 text-sm placeholder:text-sm placeholder:truncate"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground animate-pulse">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-xl">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">
            {search ? "Nenhuma loja encontrada" : "Nenhuma loja cadastrada"}
          </p>
          {!search && (
            <Button onClick={openAdd} className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Cadastrar Loja
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((l) => (
            <LojaCard
              key={l.id}
              loja={l}
              ativaId={lojaAtiva?.id ?? null}
              metrics={metricsByLoja[l.id]}
              loadingMetrics={loadingMetrics}
              onClick={() => setSheetLojaId(l.id)}
            />
          ))}
        </div>
      )}

      {/* Sheet de detalhes */}
      <LojaSheet
        loja={sheetLoja}
        open={!!sheetLojaId}
        onOpenChange={(o) => !o && setSheetLojaId(null)}
        ativaId={lojaAtiva?.id ?? null}
        metrics={sheetLoja ? metricsByLoja[sheetLoja.id] : undefined}
        loadingMetrics={loadingMetrics}
        onActivate={handleActivate}
        onEdit={openEdit}
        onDelete={(l) => {
          if (confirm(`Remover "${getDisplayName(l)}"?`)) deleteMutation.mutate(l.id);
        }}
      />

      {/* Modal de edição/criação */}
      <LojaEditModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={!!editingId}
        form={form}
        setForm={setForm}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
      />

      <PlanosModal open={showPlanos} onClose={() => setShowPlanos(false)} />
    </div>
  );
};

export default LojasPage;
