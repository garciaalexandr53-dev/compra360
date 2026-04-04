import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Download, Package, MoreHorizontal, Store, AlertTriangle, Pencil, Undo2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const FuncionariosPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, lojas } = useLojaAtiva();
  const navigate = useNavigate();
  const [linkLojaId, setLinkLojaId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");

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

  const { data: cotacoesAtivas = [] } = useQuery({
    queryKey: ["cotacoes-ativas-lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("id, loja_id")
        .eq("status", "ativa");
      if (error) throw error;
      return data;
    },
  });

  const lojasComCotacaoAtiva = new Set(cotacoesAtivas.map((c: any) => c.loja_id).filter(Boolean));

  const pendentes = itens.filter((i: any) => !i.importado);
  const importados = itens.filter((i: any) => i.importado);

  const pendentesImportaveis = pendentes.filter((i: any) => {
    const lid = i.loja_id || lojaAtiva?.id;
    return !lid || !lojasComCotacaoAtiva.has(lid);
  });
  const pendentesBloqueados = pendentes.filter((i: any) => {
    const lid = i.loja_id || lojaAtiva?.id;
    return lid && lojasComCotacaoAtiva.has(lid);
  });

  const importarMutation = useMutation({
    mutationFn: async () => {
      const itemsToImport = pendentesImportaveis.filter((i: any) => !i.importado);
      if (!itemsToImport.length) throw new Error("Nenhum item disponível para importação");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Auto-criar cotações ativas para lojas que não têm
      let createdNewCotacao = false;
      const lojaIds = [...new Set(itemsToImport.map((i: any) => i.loja_id).filter(Boolean))];
      for (const lojaId of lojaIds) {
        const { data: cotExistente } = await supabase
          .from("cotacoes")
          .select("id")
          .eq("status", "ativa")
          .eq("loja_id", lojaId)
          .limit(1)
          .maybeSingle();
        if (!cotExistente) {
          const { error: cotError } = await supabase.from("cotacoes").insert({
            nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`,
            status: "ativa" as any,
            loja_id: lojaId,
            created_by: user.id,
          });
          if (cotError) throw cotError;
          createdNewCotacao = true;
        }
      }
      const temSemLoja = itemsToImport.some((i: any) => !i.loja_id);
      if (temSemLoja) {
        const { data: cotSemLoja } = await supabase
          .from("cotacoes")
          .select("id")
          .eq("status", "ativa")
          .is("loja_id", null)
          .limit(1)
          .maybeSingle();
        if (!cotSemLoja) {
          await supabase.from("cotacoes").insert({
            nome: `Cotação ${new Date().toLocaleDateString("pt-BR")}`,
            status: "ativa" as any,
            loja_id: null,
            created_by: user.id,
          });
          createdNewCotacao = true;
        }
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
        embalagem: item.observacao?.replace("Embalagem: ", "") || "un",
        ativo: true,
        user_id: user.id,
      }));

      if (inserts.length) {
        const { error: prodErr } = await supabase.from("produtos").insert(inserts);
        if (prodErr) throw prodErr;
      }

      const itemsByLoja = new Map<string, any[]>();
      for (const item of itemsToImport) {
        const lid = (item as any).loja_id || lojaAtiva?.id || "__none__";
        if (!itemsByLoja.has(lid)) itemsByLoja.set(lid, []);
        itemsByLoja.get(lid)!.push(item);
      }

      for (const [lojaId, lojaItems] of itemsByLoja) {
        let cotacaoId: string | null = null;
        if (lojaId !== "__none__") {
          const { data: cot } = await supabase
            .from("cotacoes")
            .select("id")
            .eq("status", "ativa")
            .eq("loja_id", lojaId)
            .limit(1)
            .maybeSingle();
          cotacaoId = cot?.id || null;
        }

        if (cotacaoId) {
          const allNames = lojaItems.map((i: any) => i.nome);
          const { data: matchedProds } = await supabase
            .from("produtos")
            .select("id, nome")
            .in("nome", allNames);

          if (matchedProds?.length) {
            const { data: existingCp } = await supabase
              .from("cotacao_produtos")
              .select("produto_id")
              .eq("cotacao_id", cotacaoId);
            const existingProdIds = new Set((existingCp || []).map((cp) => cp.produto_id));

            const cpInserts = matchedProds
              .filter((p) => !existingProdIds.has(p.id))
              .map((p) => {
                const item = lojaItems.find((i: any) => i.nome.toLowerCase().trim() === p.nome.toLowerCase().trim());
                return {
                  cotacao_id: cotacaoId!,
                  produto_id: p.id,
                  quantidade: item?.quantidade || 1,
                };
              });
            if (cpInserts.length) {
              await supabase.from("cotacao_produtos").insert(cpInserts);
            }
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
      queryClient.invalidateQueries({ queryKey: ["cotacoes-ativas-lojas"] });
      const suffix = createdNewCotacao ? " Nova cotação criada automaticamente." : "";
      const msg = dups > 0
        ? `${total} itens importados! (${dups} duplicados ignorados)${suffix}`
        : `${total} itens importados para o Banco de Produtos!${suffix}`;
      toast.success(msg);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Import single item
  const importarItemMutation = useMutation({
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
        const { error: prodErr } = await supabase.from("produtos").insert({
          nome: item.nome,
          embalagem: item.observacao?.replace("Embalagem: ", "") || "un",
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
            .select("id, nome")
            .ilike("nome", item.nome.trim());

          if (matchedProds?.length) {
            const { data: existingCp } = await supabase
              .from("cotacao_produtos")
              .select("produto_id")
              .eq("cotacao_id", cot.id);
            const existingProdIds = new Set((existingCp || []).map((cp) => cp.produto_id));

            const cpInserts = matchedProds
              .filter((p) => !existingProdIds.has(p.id))
              .map((p) => ({
                cotacao_id: cot.id,
                produto_id: p.id,
                quantidade: item.quantidade || 1,
              }));
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

      return item.nome;
    },
    onSuccess: (nome) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-ativa"] });
      queryClient.invalidateQueries({ queryKey: ["cotacoes-ativas-lojas"] });
      toast.success(`✅ ${nome} importado para a cotação!`);
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

  const effectiveLinkLojaId = lojas.length === 1 ? lojas[0].id : linkLojaId;
  const effectiveLinkLoja = lojas.find((l) => l.id === effectiveLinkLojaId);
  const appUrl = effectiveLinkLojaId
    ? `${window.location.origin}/app-funcionarios?loja=${effectiveLinkLojaId}`
    : `${window.location.origin}/app-funcionarios`;

  const copyLink = () => {
    if (lojas.length > 1 && !effectiveLinkLojaId) {
      toast.error("Selecione a loja primeiro!");
      return;
    }
    navigator.clipboard.writeText(appUrl);
    toast.success(`Link copiado! (${effectiveLinkLoja?.nome || ""})`);
  };

  const openWhatsApp = () => {
    if (lojas.length > 1 && !effectiveLinkLojaId) {
      toast.error("Selecione a loja primeiro!");
      return;
    }
    const lojaLabel = effectiveLinkLoja ? ` da loja ${effectiveLinkLoja.nome}` : "";
    const msg = `📋 Use este link para registrar itens faltantes${lojaLabel}:\n${appUrl}\n\nBasta abrir no celular, digitar o item e enviar!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const getEmbalagem = (item: any) => {
    return item.observacao?.replace("Embalagem: ", "") || "un";
  };

  return (
    <div className="p-5 space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">App Funcionários</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{pendentes.length} pendentes</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1"><MoreHorizontal className="h-4 w-4" /><span className="text-xs">Mais</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyLink}>📋 Copiar Link</DropdownMenuItem>
            <DropdownMenuItem onClick={openWhatsApp}>📱 Enviar WhatsApp</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Loja selector for link */}
      {lojas.length > 1 && (
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            <Store className="h-3.5 w-3.5 inline mr-1" />Para qual loja?
          </label>
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
        </div>
      )}

      {/* Inline link */}
      <div className="bg-muted rounded-lg p-2 font-mono text-[10px] break-all">{appUrl}</div>

      {/* Pending items */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-600" />
            <span className="font-bold text-sm">Itens Pendentes</span>
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
              title={pendentesImportaveis.length === 0 ? "Finalize as cotações ativas antes de importar" : undefined}
            >
              <Download className="h-4 w-4 mr-1" />
              {importarMutation.isPending
                ? "Importando..."
                : pendentesImportaveis.length === 0
                  ? "Importação bloqueada"
                  : pendentesBloqueados.length > 0
                    ? `Importar ${pendentesImportaveis.length} disponíveis`
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
                  {pendentesBloqueados.length} ite{pendentesBloqueados.length === 1 ? 'm' : 'ns'} aguardando fim da cotação
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Estes itens só podem ser importados após finalizar a cotação da loja correspondente.
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
        <div className="h-[calc(100vh-380px)] overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : pendentes.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum item pendente.</div>
          ) : (
            pendentes.map((item: any, i: number) => {
              const lid = item.loja_id || lojaAtiva?.id;
              const bloqueado = lid && lojasComCotacaoAtiva.has(lid);
              const emb = getEmbalagem(item);
              const tempoRelativo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR });

              return (
                <div key={item.id} className={`flex items-start gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors ${bloqueado ? 'opacity-50' : ''}`}>
                  <span className="text-xs text-muted-foreground w-5 pt-0.5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="break-words">{item.nome}</span>
                      {bloqueado
                        ? <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">⛔ Cotação ativa</span>
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
    </div>
  );
};

export default FuncionariosPage;
