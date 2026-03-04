import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";

interface ProdutoItem {
  cotacao_produto_id: string;
  nome: string;
  embalagem: string;
  quantidade: number;
}

const FornecedorCotacaoPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [produtos, setProdutos] = useState<ProdutoItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      // Get fornecedor from token using RPC
      const { data: fId, error: fErr } = await supabase.rpc("get_supplier_id_from_token", { _token: token! });
      if (fErr || !fId) { setLoading(false); return; }
      setFornecedorId(fId);

      // Get fornecedor name
      const { data: fData } = await supabase.from("fornecedores").select("nome").eq("id", fId).single();
      if (fData) setFornecedorNome(fData.nome);

      // Get active cotação products
      const { data: cotacao } = await supabase.from("cotacoes").select("id").eq("status", "ativa").limit(1).maybeSingle();
      if (!cotacao) { setLoading(false); return; }

      const { data: cpData } = await supabase
        .from("cotacao_produtos")
        .select("id, quantidade, produtos(nome, embalagem)")
        .eq("cotacao_id", cotacao.id);

      if (cpData) {
        const items = cpData.map((cp: any) => ({
          cotacao_produto_id: cp.id,
          nome: cp.produtos?.nome || "?",
          embalagem: cp.produtos?.embalagem || "un",
          quantidade: cp.quantidade || 1,
        }));
        setProdutos(items);

        // Load existing prices for this fornecedor
        const cpIds = items.map((it) => it.cotacao_produto_id);
        const { data: existingPrices } = await supabase
          .from("precos")
          .select("cotacao_produto_id, preco")
          .eq("fornecedor_id", fId)
          .in("cotacao_produto_id", cpIds);

        if (existingPrices) {
          const p: Record<string, string> = {};
          existingPrices.forEach((ep: any) => {
            if (ep.preco !== null) p[ep.cotacao_produto_id] = formatNumber(ep.preco);
          });
          setPrices(p);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const upserts = Object.entries(prices)
        .filter(([, val]) => val.trim())
        .map(([cpId, val]) => ({
          cotacao_produto_id: cpId,
          fornecedor_id: fornecedorId,
          preco: parseFloat(val.replace(",", ".").replace(/[^0-9.]/g, "")),
        }));

      for (const u of upserts) {
        // Check if exists
        const { data: existing } = await supabase
          .from("precos")
          .select("id")
          .eq("cotacao_produto_id", u.cotacao_produto_id)
          .eq("fornecedor_id", u.fornecedor_id)
          .maybeSingle();

        if (existing) {
          await supabase.from("precos").update({ preco: u.preco }).eq("id", existing.id);
        } else {
          await supabase.from("precos").insert(u);
        }
      }

      setSent(true);
      toast.success("Preços enviados com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!fornecedorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">Link inválido</h1>
          <p className="text-muted-foreground">Este link de cotação não é válido ou expirou.</p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Preços Enviados!</h1>
          <p className="text-muted-foreground">Obrigado, {fornecedorNome}! Seus preços foram recebidos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white p-5 sticky top-0 z-10 shadow-lg">
        <h1 className="text-lg font-bold">📋 Cotação de Preços</h1>
        <p className="text-sm opacity-80">{fornecedorNome} · {produtos.length} produtos</p>
      </div>

      {/* Products */}
      <div className="p-4 space-y-3">
        {produtos.map((p, i) => (
          <div key={p.cotacao_produto_id} className="bg-card border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{i + 1}.</span>
              <span className="text-xs text-muted-foreground">{p.embalagem} · {p.quantidade} un</span>
            </div>
            <div className="font-semibold text-sm mb-3">{p.nome}</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={prices[p.cotacao_produto_id] || ""}
                onChange={(e) => setPrices({ ...prices, [p.cotacao_produto_id]: e.target.value })}
                className="font-mono text-right text-base font-bold"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg">
        <Button
          onClick={handleSend}
          disabled={sending || Object.values(prices).filter((v) => v.trim()).length === 0}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base py-6 font-bold"
        >
          {sending ? "Enviando..." : `✅ Enviar ${Object.values(prices).filter((v) => v.trim()).length} Preços`}
        </Button>
      </div>
    </div>
  );
};

export default FornecedorCotacaoPage;
