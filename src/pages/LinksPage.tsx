import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Fornecedor = Tables<"fornecedores">;

const LinksPage = () => {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa"],
    queryFn: async () => {
      const { data } = await supabase.from("cotacoes").select("id").eq("status", "ativa").limit(1).maybeSingle();
      return data;
    },
  });

  // Check which suppliers have responded
  const { data: respondidos = new Set<string>() } = useQuery({
    queryKey: ["respondidos", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return new Set<string>();
      const cpIds = cps.map((cp) => cp.id);
      const { data: precos } = await supabase
        .from("precos")
        .select("fornecedor_id")
        .in("cotacao_produto_id", cpIds)
        .not("preco", "is", null);
      return new Set((precos || []).map((p) => p.fornecedor_id));
    },
  });

  // Count prices per supplier
  const { data: precoCounts = {} as Record<string, number> } = useQuery({
    queryKey: ["preco-counts", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { data: cps } = await supabase
        .from("cotacao_produtos")
        .select("id")
        .eq("cotacao_id", cotacaoAtiva!.id);
      if (!cps?.length) return {};
      const cpIds = cps.map((cp) => cp.id);
      const { data: precos } = await supabase
        .from("precos")
        .select("fornecedor_id")
        .in("cotacao_produto_id", cpIds)
        .not("preco", "is", null);
      const counts: Record<string, number> = {};
      (precos || []).forEach((p) => {
        counts[p.fornecedor_id] = (counts[p.fornecedor_id] || 0) + 1;
      });
      return counts;
    },
  });

  const queryClient = useQueryClient();

  const regenerateTokenMutation = useMutation({
    mutationFn: async (fornecedorId: string) => {
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const { error } = await supabase.from("fornecedores").update({ token: newToken }).eq("id", fornecedorId);
      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Novo link gerado!");
    },
  });

  const getLink = (f: Fornecedor) => `${window.location.origin}/fornecedor/${f.token}`;

  const copyLink = (f: Fornecedor) => {
    navigator.clipboard.writeText(getLink(f));
    toast.success("Link copiado!");
  };

  const openWhatsApp = (f: Fornecedor) => {
    const link = getLink(f);
    const msg = `Olá ${f.nome}! Segue o link para cotação de preços:\n\n${link}\n\nPreencha os preços e envie. Obrigado!`;
    const phone = f.telefone?.replace(/\D/g, "");
    const url = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const showLink = (f: Fornecedor) => {
    setSelectedFornecedor(f);
    setLinkModalOpen(true);
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold">🔗 Links para Fornecedores</h1>
        <div className="bg-card border rounded-xl p-4 mt-3 shadow-sm">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Envie o link ao fornecedor. Ele abre no celular, preenche os preços e envia.
            Os preços são importados automaticamente na sua cotação em tempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fornecedores.map((f) => {
          const recv = respondidos.has(f.id);
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
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    recv ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}
                >
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
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyLink(f);
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(f);
                  }}
                >
                  📱 WhatsApp
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {fornecedores.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          Nenhum fornecedor cadastrado. Adicione na página de Gestão de Fornecedores.
        </div>
      )}

      {/* Link detail modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔗 Link — {selectedFornecedor?.nome}</DialogTitle>
          </DialogHeader>
          {selectedFornecedor && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Compartilhe com o fornecedor para que ele preencha os preços.
              </p>

              <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all">
                {getLink(selectedFornecedor)}
              </div>

              {/* Open direct */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(getLink(selectedFornecedor), "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir link direto
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyLink(selectedFornecedor)}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copiar link
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => openWhatsApp(selectedFornecedor)}
                >
                  📱 WhatsApp
                </Button>
              </div>

              <div className="bg-muted/50 border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                💡 <strong>Dica:</strong> O fornecedor toca no link e abre direto no navegador — sem instalar nada.
                Os preços são importados automaticamente na sua cotação.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LinksPage;
