import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Download, Package, MoreHorizontal, Store, AlertTriangle } from "lucide-react";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FuncionariosPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva, lojas } = useLojaAtiva();
  const [linkLojaId, setLinkLojaId] = useState<string>("");
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



  // Fetch active cotações to know which lojas are blocked
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

  // Pendentes that CAN be imported (loja has no active cotação)
  const pendentesImportaveis = pendentes.filter((i: any) => {
    const lid = i.loja_id || lojaAtiva?.id;
    return !lid || !lojasComCotacaoAtiva.has(lid);
  });
  // Pendentes blocked (loja has active cotação)
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

      // Check for existing products to avoid duplicates
      const { data: existingProducts } = await supabase.from("produtos").select("nome");
      const existingNames = new Set((existingProducts || []).map((p) => p.nome.toLowerCase().trim()));

      const newItems = itemsToImport.filter((i: any) => !existingNames.has(i.nome.toLowerCase().trim()));
      const dupCount = itemsToImport.length - newItems.length;

      // Insert each unique item into produtos with ativo=true and user_id
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

      // Group items by loja_id to add to the correct cotação per store
      const itemsByLoja = new Map<string, any[]>();
      for (const item of itemsToImport) {
        const lid = (item as any).loja_id || lojaAtiva?.id || "__none__";
        if (!itemsByLoja.has(lid)) itemsByLoja.set(lid, []);
        itemsByLoja.get(lid)!.push(item);
      }

      // For each loja group, find the active cotação and add products
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

      // Mark all as imported
      const ids = itemsToImport.map((i: any) => i.id);
      const { error } = await supabase
        .from("itens_faltantes")
        .update({ importado: true })
        .in("id", ids);
      if (error) throw error;

      return { total: newItems.length, dups: dupCount };
    },
    onSuccess: ({ total, dups }) => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cotacao-item-count"] });
      const msg = dups > 0
        ? `${total} itens importados! (${dups} duplicados ignorados)`
        : `${total} itens importados para o Banco de Produtos!`;
      toast.success(msg);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itens_faltantes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
    },
  });

  const limparImportados = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("itens_faltantes").delete().eq("importado", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens-faltantes"] });
      toast.success("Histórico limpo!");
    },
  });

  // Determine which loja to use for the link
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
          {pendentesImportaveis.length > 0 && (
            <Button
              size="sm"
              onClick={() => importarMutation.mutate()}
              disabled={importarMutation.isPending}
              className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
            >
              <Download className="h-4 w-4 mr-1" />
              {importarMutation.isPending ? "Importando..." : `Importar ${pendentesImportaveis.length} itens`}
            </Button>
          )}
        </div>
        <div className="h-[calc(100vh-380px)] overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando...</div>
          ) : pendentes.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum item pendente.</div>
          ) : (
            pendentes.map((item: any, i: number) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors">
                <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.registrado_por && `Por: ${item.registrado_por} · `}
                    {(item as any).lojas?.nome && `Loja: ${(item as any).lojas.nome} · `}
                    {item.quantidade > 1 && `Qtd: ${item.quantidade} · `}
                    {item.observacao && `${item.observacao} · `}
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Imported history */}
      {importados.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-muted-foreground">Já Importados</span>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {importados.length}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => limparImportados.mutate()}>
              Limpar histórico
            </Button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {importados.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2 border-b text-muted-foreground">
                <span className="text-xs">✓</span>
                <span className="text-sm line-through">{item.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FuncionariosPage;
