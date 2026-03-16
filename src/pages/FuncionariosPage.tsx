import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Download, ExternalLink, Package } from "lucide-react";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { toast } from "sonner";

const FuncionariosPage = () => {
  const queryClient = useQueryClient();
  const { lojaAtiva } = useLojaAtiva();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens-faltantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_faltantes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const pendentes = itens.filter((i: any) => !i.importado);
  const importados = itens.filter((i: any) => i.importado);

  const importarMutation = useMutation({
    mutationFn: async () => {
      const itemsToImport = pendentes.filter((i: any) => !i.importado);
      if (!itemsToImport.length) throw new Error("Nenhum item pendente");

      // Check for existing products to avoid duplicates
      const { data: existingProducts } = await supabase.from("produtos").select("nome");
      const existingNames = new Set((existingProducts || []).map((p) => p.nome.toLowerCase().trim()));

      const newItems = itemsToImport.filter((i: any) => !existingNames.has(i.nome.toLowerCase().trim()));
      const dupCount = itemsToImport.length - newItems.length;

      // Insert each unique item into produtos with ativo=true so they appear in cotação
      const inserts = newItems.map((item: any) => ({
        nome: item.nome,
        embalagem: item.observacao?.replace("Embalagem: ", "") || "un",
        ativo: true,
      }));

      if (inserts.length) {
        const { error: prodErr } = await supabase.from("produtos").insert(inserts);
        if (prodErr) throw prodErr;
      }

      // If there's an active cotação, also add to cotacao_produtos with correct quantities
      if (cotacaoAtiva) {
        // Get all products that match imported names (includes previously existing ones)
        const allNames = itemsToImport.map((i: any) => i.nome);
        const { data: matchedProds } = await supabase
          .from("produtos")
          .select("id, nome")
          .in("nome", allNames);

        if (matchedProds?.length) {
          // Check which are already in cotacao_produtos
          const { data: existingCp } = await supabase
            .from("cotacao_produtos")
            .select("produto_id")
            .eq("cotacao_id", cotacaoAtiva.id);
          const existingProdIds = new Set((existingCp || []).map((cp) => cp.produto_id));

          const cpInserts = matchedProds
            .filter((p) => !existingProdIds.has(p.id))
            .map((p) => {
              const item = itemsToImport.find((i: any) => i.nome.toLowerCase().trim() === p.nome.toLowerCase().trim());
              return {
                cotacao_id: cotacaoAtiva.id,
                produto_id: p.id,
                quantidade: item?.quantidade || 1,
              };
            });
          if (cpInserts.length) {
            await supabase.from("cotacao_produtos").insert(cpInserts);
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

  const appUrl = `${window.location.origin}/app-funcionarios`;

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    toast.success("Link copiado!");
  };

  const openWhatsApp = () => {
    const msg = `📋 Use este link para registrar itens faltantes:\n${appUrl}\n\nBasta abrir no celular, digitar o item e enviar!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">👥 App Funcionários</h1>
          <p className="text-sm text-muted-foreground">
            Funcionários registram itens faltantes sem acessar o sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            📋 Copiar Link
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={openWhatsApp}>
            📱 WhatsApp
          </Button>
        </div>
      </div>

      {/* Link card */}
      <div className="bg-card border rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold">Link do App</span>
        </div>
        <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all mb-3">{appUrl}</div>
        <p className="text-xs text-muted-foreground">
          Compartilhe este link com os funcionários. Eles abrem no celular, digitam os itens faltantes e enviam.
          Você importa a lista aqui para o Banco de Produtos e monta a cotação.
        </p>
      </div>

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
              disabled={importarMutation.isPending}
              className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
            >
              <Download className="h-4 w-4 mr-1" />
              {importarMutation.isPending ? "Importando..." : `Importar ${pendentes.length} itens`}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
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
        </ScrollArea>
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
          <ScrollArea className="max-h-[200px]">
            {importados.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2 border-b text-muted-foreground">
                <span className="text-xs">✓</span>
                <span className="text-sm line-through">{item.nome}</span>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default FuncionariosPage;
