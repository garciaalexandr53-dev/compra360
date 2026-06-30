import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Download, Package, Store, AlertTriangle, Pencil, Undo2, ArrowRight, Copy, MessageCircle, Check, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { toast } from "sonner";
import { buildWhatsAppUrl } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ConferenciaPedidos from "@/components/ConferenciaPedidos";
import { buildCotacaoProdutoInsertFromItem } from "@/lib/itensFaltantesImport";
export const parseFatorFromObs = (obs: string | null): number => {
  const match = obs?.match(/Fator:\s*(\d+)/);
  return match ? parseInt(match[1]) : 1;
};
export const parseEmbFromObs = (obs: string | null): string => {
  const match = obs?.match(/Embalagem:\s*(\S+)/);
  return match ? match[1] : "un";
};
export const temObservacaoFator = (obs: string | null | undefined): boolean => {
  return !!obs && /Fator:\s*\d+/.test(obs);
};
export const temObservacaoEmb = (obs: string | null | undefined): boolean => {
  return !!obs && /Embalagem:\s*\S+/.test(obs);
};

/**
 * Resolve o fator de embalagem com a prioridade:
 * 1. Se o funcionário informou explicitamente na observação → usar valor da obs (mesmo que seja 1)
 * 2. Caso contrário → cadastro do produto (se > 0)
 * 3. Fallback final → 1
 */
export const resolveFator = (
  observacao: string | null | undefined,
  produtoFator: number | null | undefined,
): number => {
  if (temObservacaoFator(observacao)) {
    return parseFatorFromObs(observacao ?? null);
  }
  if (temObservacaoEmb(observacao)) {
    const emb = parseEmbFromObs(observacao ?? null).trim().toLowerCase();
    if (["un", "uni", "unid", "unidade"].includes(emb)) return 1;
  }
  return produtoFator && produtoFator > 0 ? produtoFator : 1;
};

/**
 * Resolve a embalagem com a prioridade:
 * 1. Se o funcionário informou explicitamente na observação → usar valor da obs (mesmo que seja "un")
 * 2. Caso contrário → primeira opção do cadastro do produto
 * 3. Fallback final → "UNI"
 * Sempre retorna em UPPERCASE.
 */
export const resolveEmbalagem = (
  observacao: string | null | undefined,
  produtoEmbalagem: string | null | undefined,
): string => {
  if (temObservacaoEmb(observacao)) {
    return parseEmbFromObs(observacao ?? null).toUpperCase();
  }
  const fromCadastro = produtoEmbalagem && produtoEmbalagem.trim()
    ? produtoEmbalagem.split("|")[0].trim()
    : "UNI";
  return fromCadastro.toUpperCase();
};

const FuncionariosPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, lojas, setLojaAtivaId } = useLojaAtiva();
  const navigate = useNavigate();
  const [linkLojaId, setLinkLojaId] = useState<string>("");

  useEffect(() => {
    if (lojaAtiva?.id && !linkLojaId) {
      setLinkLojaId(lojaAtiva.id);
    }
  }, [lojaAtiva?.id]);
  const [activeTab, setActiveTab] = useState("itens");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  const effectiveLinkLojaId = lojas.length === 1 ? lojas[0].id : linkLojaId;
  const effectiveLinkLoja = lojas.find((l) => l.id === effectiveLinkLojaId);

  // Loja efetiva para filtrar itens: usa linkLojaId se selecionado, senão lojaAtiva
  const lojaEfetiva = effectiveLinkLojaId
    ? lojas.find((l) => l.id === effectiveLinkLojaId)
    : lojaAtiva;
  const lojaEfetivaId = lojaEfetiva?.id;

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens-faltantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_faltantes")
        .select("*, lojas(id, nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch active cotação for the active store
  const { data: cotacaoAtivaLoja } = useQuery({
    queryKey: ["cotacao-ativa-loja", lojaEfetivaId],
    queryFn: async () => {
      if (!lojaEfetivaId) return null;
      const { data, error } = await supabase
        .from("cotacoes")
        .select("id, loja_id")
        .eq("status", "ativa")
        .eq("loja_id", lojaEfetivaId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lojaEfetivaId,
  });

  // Check if any supplier has sent prices for the active cotação
  const { data: precosCount = 0 } = useQuery({
    queryKey: ["cotacao-precos-count", cotacaoAtivaLoja?.id],
    queryFn: async () => {
      if (!cotacaoAtivaLoja?.id) return 0;
      const { count, error } = await supabase
        .from("precos")
        .select("id", { count: "exact", head: true })
        .not("preco", "is", null)
        .in(
          "cotacao_produto_id",
          (await supabase
            .from("cotacao_produtos")
            .select("id")
            .eq("cotacao_id", cotacaoAtivaLoja.id)
          ).data?.map((cp: any) => cp.id) || []
        );
      if (error) throw error;
      return count || 0;
    },
    enabled: !!cotacaoAtivaLoja?.id,
  });

  const cotacaoTemPrecos = precosCount > 0;

  // Filter items: only show items from the active store
  const allPendentes = itens.filter((i: any) => !i.importado);
  const pendentes = allPendentes.filter((i: any) => {
    if (!lojaEfetivaId) return true;
    return i.loja_id === lojaEfetivaId || !i.loja_id;
  });
  const importados = itens.filter((i: any) =>
    i.importado && (i.loja_id === lojaEfetivaId || !i.loja_id)
  );
  const outrasLojas = allPendentes.filter((i: any) =>
    lojaEfetivaId && i.loja_id && i.loja_id !== lojaEfetivaId
  );

  // Allow import if: no active cotação OR cotação has no prices yet
  const canImport = !cotacaoAtivaLoja || !cotacaoTemPrecos;
  const pendentesImportaveis = canImport ? pendentes : [];
  const pendentesBloqueados = canImport ? [] : pendentes;

  const importarMutation = useMutation({
    mutationFn: async () => {
      const itemsToImport = pendentesImportaveis.filter((i: any) => !i.importado);
      if (!itemsToImport.length) throw new Error("Nenhum item disponível para importação");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const targetLojaId = lojaEfetivaId;
      if (!targetLojaId) throw new Error("Selecione uma loja ativa");

      // Ensure active cotação exists for the active store
      let createdNewCotacao = false;
      let { data: cot } = await supabase
        .from("cotacoes")
        .select("id")
        .eq("status", "ativa")
        .eq("loja_id", targetLojaId)
        .limit(1)
        .maybeSingle();

      if (!cot) {
        const { data: newCot, error: cotError } = await supabase.from("cotacoes").insert({
          nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`,
          status: "ativa" as any,
          loja_id: targetLojaId,
          created_by: user.id,
        }).select("id").single();
        if (cotError) throw cotError;
        cot = newCot;
        createdNewCotacao = true;
      }

      // Buscar TODOS os produtos com paginação (evitar limite de 1000)
      let allExisting: { nome: string }[] = [];
      const batchSize = 1000;
      let from = 0;
      while (true) {
        const { data } = await supabase.from("produtos").select("nome").range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        allExisting = allExisting.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      const existingNames = new Set(allExisting.map((p) => p.nome.toLowerCase().trim()));

      const newItems = itemsToImport.filter((i: any) => !existingNames.has(i.nome.toLowerCase().trim()));
      const dupCount = itemsToImport.length - newItems.length;


      const inserts = newItems.map((item: any) => ({
        nome: item.nome,
        embalagem: parseEmbFromObs(item.observacao),
        fator_embalagem: parseFatorFromObs(item.observacao),
        ativo: true,
        user_id: user.id,
      }));

      if (inserts.length) {
        const { error: prodErr } = await supabase.from("produtos").insert(inserts);
        if (prodErr) throw prodErr;
      }

      // Link products to the active store's cotação
      const cotacaoId = cot?.id;
      if (cotacaoId) {
        const allNames = itemsToImport.map((i: any) => i.nome);
        const { data: matchedProds } = await supabase
          .from("produtos")
          .select("id, nome, embalagem, fator_embalagem")
          .in("nome", allNames);

        if (matchedProds?.length) {
          const { data: existingCp } = await supabase
            .from("cotacao_produtos")
            .select("produto_id")
            .eq("cotacao_id", cotacaoId);
          const existingProdIds = new Set((existingCp || []).map((cp) => cp.produto_id));

          const cpInserts = matchedProds
            .filter((p) => !existingProdIds.has(p.id))
            .map((p: any) => {
              const item = itemsToImport.find((i: any) => i.nome.toLowerCase().trim() === p.nome.toLowerCase().trim());
              return {
                cotacao_id: cotacaoId,
                produto_id: p.id,
                quantidade: item?.quantidade || 1,
                fator_embalagem: resolveFator(item?.observacao, p.fator_embalagem),
                tipo_embalagem: resolveEmbalagem(item?.observacao, p.embalagem),
              };
            });
          if (cpInserts.length) {
            await supabase.from("cotacao_produtos").insert(cpInserts);
          }
        }
      }

      const ids = itemsToImport.map((i: any) => i.id);
      const { error } = await supabase
        .from("itens_faltantes")
        .update({ importado: true })
        .in("id", ids);
      if (error) throw error;

      return { total: newItems.length, dups: dupCount, createdNewCotacao };
    },
    onSuccess: ({ total, dups, createdNewCotacao }) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa-loja"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-precos-count"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
      const suffix = createdNewCotacao ? " Nova cotação criada automaticamente." : "";
      const msg = dups > 0
        ? `${total} itens importados! (${dups} duplicados ignorados)${suffix}`
        : `${total} itens importados para o Banco de Produtos!${suffix}`;
      toast.success(msg);
      navigate("/dashboard");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Import single item
  const importarItemMutation = useMutation<{ nome: string; lojaId: string | null; lojaNome: string | null }, any, any>({
    mutationFn: async (item: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar TODOS os produtos com paginação
      let allExisting: { nome: string }[] = [];
      let fromIdx = 0;
      while (true) {
        const { data } = await supabase.from("produtos").select("nome").range(fromIdx, fromIdx + 999);
        if (!data || data.length === 0) break;
        allExisting = allExisting.concat(data);
        if (data.length < 1000) break;
        fromIdx += 1000;
      }
      const existingNames = new Set(allExisting.map((p) => p.nome.toLowerCase().trim()));

      if (!existingNames.has(item.nome.toLowerCase().trim())) {
        const singleFator = parseFatorFromObs(item.observacao);
        const singleEmb = parseEmbFromObs(item.observacao);
        const { error: prodErr } = await supabase.from("produtos").insert({
          nome: item.nome,
          embalagem: singleEmb,
          fator_embalagem: singleFator,
          ativo: true,
          user_id: user.id,
        });
        if (prodErr) throw prodErr;
      }

      const lid = item.loja_id || lojaAtiva?.id;
      if (lid) {
        let { data: cot } = await supabase
          .from("cotacoes")
          .select("id")
          .eq("status", "ativa")
          .eq("loja_id", lid)
          .limit(1)
          .maybeSingle();

        if (!cot) {
          const { data: newCot, error: cotError } = await supabase
            .from("cotacoes")
            .insert({
              nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`,
              status: "ativa" as any,
              loja_id: lid,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (cotError) throw cotError;
          cot = newCot;
        }

        if (cot?.id) {
          const { data: matchedProds } = await supabase
            .from("produtos")
            .select("id, nome, embalagem, fator_embalagem")
            .ilike("nome", item.nome.trim());

          if (matchedProds?.length) {
            const { data: existingCp } = await supabase
              .from("cotacao_produtos")
              .select("produto_id")
              .eq("cotacao_id", cot.id);
            const existingProdIds = new Set((existingCp || []).map((cp) => cp.produto_id));

            const cpInserts = matchedProds
              .filter((p) => !existingProdIds.has(p.id))
              .map((p: any) => {
                return {
                  cotacao_id: cot.id,
                  produto_id: p.id,
                  quantidade: item.quantidade || 1,
                  fator_embalagem: resolveFator(item.observacao, p.fator_embalagem),
                  tipo_embalagem: resolveEmbalagem(item.observacao, p.embalagem),
                };
              });
            if (cpInserts.length) {
              await supabase.from("cotacao_produtos").insert(cpInserts);
            }
          }
        }
      }

      const { error } = await supabase
        .from("itens_faltantes")
        .update({ importado: true })
        .eq("id", item.id);
      if (error) throw error;

      return {
        nome: item.nome,
        lojaId: item.loja_id || lojaAtiva?.id || null,
        lojaNome: item.lojas?.nome || lojaAtiva?.nome || null,
      };
    },
    onSuccess: ({ nome, lojaId, lojaNome }) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa-loja"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-precos-count"] });
      queryClient.invalidateQueries({ queryKey: ["precos"] });
      const isOutraLoja = lojaId && lojaId !== lojaAtiva?.id;
      if (isOutraLoja && lojaNome) {
        toast.success(`✅ ${nome} importado para a cotação de ${lojaNome}`, {
          action: {
            label: "Abrir cotação",
            onClick: () => {
              setLojaAtivaId(lojaId);
              navigate("/dashboard");
            },
          },
          duration: 6000,
        });
      } else {
        toast.success(`✅ ${nome} importado para a cotação${lojaNome ? ` de ${lojaNome}` : ""}!`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("itens_faltantes").delete().eq("id", id);
      if (error) throw error;
      return nome;
    },
    onSuccess: (nome) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      toast.success("Item removido");
    },
  });

  const updateQtyMutation = useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) => {
      const { error } = await supabase
        .from("itens_faltantes")
        .update({ quantidade })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
    },
  });

  const restaurarMutation = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("itens_faltantes")
        .update({ importado: false })
        .eq("id", item.id);
      if (error) throw error;
      return item.nome;
    },
    onSuccess: (nome) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      toast.success(`✅ ${nome} restaurado para pendentes!`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const limparImportados = useMutation({
    mutationFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { error } = await supabase
        .from("itens_faltantes")
        .delete()
        .eq("importado", true)
        .lt("created_at", thirtyDaysAgo.toISOString());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      toast.success("Itens antigos removidos!");
    },
  });

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditQty("");
  };

  const handleSaveQty = (id: string) => {
    const qty = parseInt(editQty);
    if (qty > 0) {
      updateQtyMutation.mutate({ id, quantidade: qty });
    }
    setEditingId(null);
  };

  const handleDelete = (item: any) => {
    if (confirm(`Remover ${item.nome}?`)) {
      deleteMutation.mutate({ id: item.id, nome: item.nome });
    }
  };

  const publicOrigin = import.meta.env.VITE_APP_PUBLIC_URL || "https://compra360app.com.br";
  const baseUrl = `${publicOrigin.replace(/\/$/, "")}/reposicao`;
  const appUrl = effectiveLinkLojaId
    ? `${baseUrl}?loja=${effectiveLinkLojaId}`
    : baseUrl;

  const copyLink = () => {
    if (!effectiveLinkLojaId) {
      toast.error("Selecione a loja no topo da tela!");
      return;
    }
    navigator.clipboard.writeText(appUrl);
    toast.success(`Link copiado! (${effectiveLinkLoja?.nome || ""})`);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  const openWhatsApp = () => {
    if (!effectiveLinkLojaId) {
      toast.error("Selecione a loja no topo da tela!");
      return;
    }
    const lojaLabel = effectiveLinkLoja ? ` da loja ${effectiveLinkLoja.nome}` : "";
    const msg = `📋 Use este link para registrar itens faltantes${lojaLabel}:\n${appUrl}\n\nBasta abrir no celular, digitar o item e enviar!`;
    window.open(buildWhatsAppUrl(null, msg), "_blank");
  };

  const getEmbalagem = (item: any) => {
    return item.observacao?.replace("Embalagem: ", "") || "un";
  };

  return (
    <div className="p-5 space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-3">
          <TabsTrigger value="itens" className="flex-1 gap-1.5">
            <Package className="h-4 w-4" />
            Itens Faltantes
          </TabsTrigger>
          <TabsTrigger value="conferencia" className="flex-1 gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Conferência
          </TabsTrigger>
        </TabsList>

        {/* Loja selector + sharing - only on Itens Faltantes tab */}
        {activeTab === "itens" && (
          <div className="bg-card border rounded-xl shadow-sm p-4 space-y-3 mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              <Store className="h-3.5 w-3.5 inline mr-1" />Qual loja precisa abastecer?
            </label>
            {lojas.length > 1 ? (
              <Select value={linkLojaId} onValueChange={setLinkLojaId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a loja para gerar o link" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : effectiveLinkLoja ? (
              <p className="text-sm text-foreground font-medium">{effectiveLinkLoja.nome}</p>
            ) : null}
            <p className="text-xs text-muted-foreground text-left mt-1 mb-2">Enviar formulário para equipe</p>
            <div className="flex flex-row gap-2">

              <Button
                variant={linkCopiado ? "default" : "outline"}
                size="sm"
                className={`h-9 gap-1.5 flex-1 ${linkCopiado ? "bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90 text-primary-foreground" : ""}`}
                onClick={copyLink}
                disabled={!effectiveLinkLojaId}
              >
                {linkCopiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="text-sm">{linkCopiado ? "✓ Copiado!" : "Copiar Link"}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-1" onClick={openWhatsApp} disabled={!effectiveLinkLojaId}>
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm">WhatsApp</span>
              </Button>
            </div>
          </div>
        )}

        <TabsContent value="itens" className="space-y-3">

      {/* Pending items */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            <div>
              <span className="font-bold text-sm">Itens Pendentes</span>
              {lojaEfetiva && (
                <div className="text-[10px] text-muted-foreground">{lojaEfetiva.nome}</div>
              )}
            </div>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {pendentes.length}
            </span>
          </div>
          {pendentes.length > 0 && (
            <Button
              size="sm"
              onClick={() => importarMutation.mutate()}
              disabled={importarMutation.isPending || pendentesImportaveis.length === 0}
              className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] disabled:opacity-50"
              title={pendentesImportaveis.length === 0 ? "Fornecedores já responderam preços nesta cotação" : undefined}
            >
              <Download className="h-4 w-4 mr-1" />
              {importarMutation.isPending
                ? "Importando..."
                : pendentesImportaveis.length === 0
                  ? "Bloqueado (preços recebidos)"
                  : `Importar ${pendentesImportaveis.length}`}
            </Button>
          )}
        </div>
        {pendentesBloqueados.length > 0 && (
          <div className="m-3 mb-0 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">⛔</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-destructive">
                  Fornecedores já enviaram preços nesta cotação
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Para importar novos itens, finalize a cotação atual e inicie uma nova.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-6 px-0 text-xs text-primary mt-1 gap-1"
                  onClick={() => navigate("/cotacao")}
                >
                  Ir para cotação <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {outrasLojas.length > 0 && (() => {
          const grupos = Array.from(
            outrasLojas.reduce((map: Map<string, { nome: string; count: number }>, i: any) => {
              const id = i.loja_id;
              const nome = i.lojas?.nome || "Outra loja";
              const cur = map.get(id) || { nome, count: 0 };
              cur.count += 1;
              map.set(id, cur);
              return map;
            }, new Map()).entries()
          );
          return (
            <div className="m-3 mb-0 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground">
                📋 Itens pendentes em outras lojas
              </p>
              <div className="flex flex-wrap gap-2">
                {grupos.map(([id, info]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setLojaAtivaId(id);
                      setLinkLojaId(id);
                      toast.success(`Loja ativa alterada para ${info.nome}`);
                    }}
                  >
                    <Store className="h-3 w-3" />
                    {info.nome} ({info.count})
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Toque em uma loja para abrir a cotação dela em paralelo — as cotações são independentes por loja.
              </p>
            </div>
          );
        })()}
        <div className="h-[calc(100vh-380px)] overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : pendentes.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum item pendente.</div>
          ) : (
            pendentes.map((item: any, i: number) => {
              const bloqueado = !canImport;
              const emb = getEmbalagem(item);
              const tempoRelativo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR });

              return (
                <div key={item.id} className={`flex items-start gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors ${bloqueado ? 'opacity-50' : ''}`}>
                  <span className="text-xs text-muted-foreground w-5 pt-0.5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="break-words">{item.nome}</span>
                      {item.loja_id && item.lojas?.nome && (
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">📍 {item.lojas.nome}</span>
                      )}
                      {bloqueado
                        ? <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">⛔ Fornecedor já respondeu</span>
                        : <span className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">✅ Disponível</span>
                      }
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          className="w-20 h-7 text-center text-sm inline-block"
                          autoFocus
                          placeholder={String(item.quantidade || 1)}
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveQty(item.id); }}
                          onBlur={() => handleSaveQty(item.id)}
                        />
                      ) : (
                        <>Qtd: {item.quantidade || 1} · {emb} · {tempoRelativo}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleStartEdit(item)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {!bloqueado && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        onClick={() => importarItemMutation.mutate(item)}
                        disabled={importarItemMutation.isPending}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Imported history */}
      {importados.length > 0 && (() => {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oldCount = importados.filter((i: any) => new Date(i.created_at) < thirtyDaysAgo).length;

        return (
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-muted-foreground">Já Importados</span>
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {importados.length}
                </span>
              </div>
              {oldCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive"
                  onClick={() => {
                    if (confirm(`Remover apenas ${oldCount} ite${oldCount === 1 ? 'm' : 'ns'} com mais de 30 dias?`)) {
                      limparImportados.mutate();
                    }
                  }}
                >
                  Limpar antigos ({oldCount})
                </Button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {importados.map((item: any) => {
                const emb = getEmbalagem(item);
                const createdAt = new Date(item.created_at);
                const tempoRelativo = formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR });
                const isOld = createdAt < thirtyDaysAgo;
                const daysLeft = isOld ? 0 : Math.ceil((createdAt.getTime() + 30 * 86400000 - now.getTime()) / 86400000);

                return (
                  <div key={item.id} className={`flex items-start gap-2 px-4 py-3 border-b ${isOld ? 'opacity-40' : ''}`}>
                    <span className="text-xs text-green-600 pt-0.5 shrink-0">✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-muted-foreground break-words">{item.nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Qtd: {item.quantidade || 1} · {emb} · Importado {tempoRelativo}
                        {isOld && <span className="ml-1 text-amber-500 font-medium">· Expira em breve</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary shrink-0 gap-1 px-2"
                      onClick={() => restaurarMutation.mutate(item)}
                      disabled={restaurarMutation.isPending}
                    >
                      <Undo2 className="h-3 w-3" />
                      Restaurar
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

        </TabsContent>
        <TabsContent value="conferencia">
          <ConferenciaPedidos />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FuncionariosPage;
