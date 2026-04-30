import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const lojaParam = searchParams.get("loja");
  const [loading, setLoading] = useState(true);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [lojaNome, setLojaNome] = useState("");
  const [produtos, setProdutos] = useState<ProdutoItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const hasAnyPrice = Object.values(prices).some(v => v.trim().length > 0);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      // Get fornecedor info from token using secure RPC (no token exposure)
      const { data: supplierInfo, error: fErr } = await supabase.rpc("get_supplier_info", { _token: token! });
      const supplier = supplierInfo?.[0];
      if (fErr || !supplier) { setLoading(false); return; }
      setFornecedorId(supplier.id);
      setFornecedorNome(supplier.nome);

      // Get lojas this supplier serves
      const { data: fornecedorLojas } = await supabase
        .from("fornecedor_lojas")
        .select("loja_id")
        .eq("fornecedor_id", supplier.id);
      const lojaIds = (fornecedorLojas || []).map((fl: any) => fl.loja_id);

      // Find the active cotação this supplier was assigned to.
      // Priority:
      //   1. If ?loja=ID is in URL → use cotação ativa dessa loja AND verify supplier was assigned to it.
      //   2. Otherwise, find any cotação ativa where this supplier appears in cotacao_fornecedores
      //      (preferring lojas the supplier serves).
      // Never silently fall back to "any active cotação" — that shows wrong/empty lists to suppliers.
      let cotacao: { id: string; loja_id: string | null } | null = null;

      if (lojaParam) {
        const { data } = await supabase
          .from("cotacoes")
          .select("id, loja_id")
          .in("status", ["ativa", "finalizada"])
          .eq("loja_id", lojaParam)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          // Verify supplier was actually assigned to this cotação
          const { data: assigned } = await supabase
            .from("cotacao_fornecedores")
            .select("id")
            .eq("cotacao_id", data.id)
            .eq("fornecedor_id", supplier.id)
            .maybeSingle();
          if (assigned) cotacao = data;
        }
      }

      if (!cotacao) {
        // Find cotações this supplier was assigned to (preferring supplier's lojas)
        const { data: assignments } = await supabase
          .from("cotacao_fornecedores")
          .select("cotacao_id, cotacoes!inner(id, loja_id, status, created_at)")
          .eq("fornecedor_id", supplier.id)
          .in("cotacoes.status", ["ativa", "finalizada"])
          .order("created_at", { foreignTable: "cotacoes", ascending: false });

        const candidates = (assignments || [])
          .map((a: any) => a.cotacoes)
          .filter(Boolean) as Array<{ id: string; loja_id: string | null }>;

        if (candidates.length > 0) {
          // Prefer one matching a loja this supplier serves
          cotacao =
            candidates.find((c) => c.loja_id && lojaIds.includes(c.loja_id)) ||
            candidates[0];
        }
      }

      if (!cotacao) {
        setErrorMsg(
          "Nenhuma cotação ativa foi encontrada para você no momento. Se você acredita que isso é um erro, entre em contato com o solicitante."
        );
        setLoading(false);
        return;
      }

      // Get loja name if linked
      if (cotacao.loja_id) {
        const { data: lojaData } = await supabase.rpc("get_lojas_public", { _loja_id: cotacao.loja_id });
        if (lojaData?.[0]) setLojaNome(lojaData[0].nome);
      }

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
        })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        setProdutos(items);

        // Load existing prices for this fornecedor
        const cpIds = items.map((it) => it.cotacao_produto_id);
        const { data: existingPrices } = await supabase
          .from("precos")
          .select("cotacao_produto_id, preco")
          .eq("fornecedor_id", supplier.id)
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

  const formatCurrency = (raw: string): string => {
    // Remove tudo exceto dígitos
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const cents = parseInt(digits, 10);
    const value = (cents / 100).toFixed(2);
    const [int, dec] = value.split(".");
    const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedInt},${dec}`;
  };

  const handlePriceChange = (cpId: string, raw: string) => {
    setPrices({ ...prices, [cpId]: formatCurrency(raw) });
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const priceEntries = Object.entries(prices)
        .filter(([, val]) => val.trim())
        .map(([cpId, val]) => ({
          cotacao_produto_id: cpId,
          preco: parseFloat(val.replace(/\./g, "").replace(",", ".")),
        }));

      const { data, error } = await supabase.functions.invoke("submit-precos", {
        body: { token, prices: priceEntries },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao enviar");
      }

      setSent(true);
      toast.success("Preços enviados com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    }
    setSending(false);
  };

  const handleNoItems = async () => {
    setSending(true);
    try {
      const priceEntries = produtos.map(p => ({
        cotacao_produto_id: p.cotacao_produto_id,
        preco: 0,
      }));

      const { data, error } = await supabase.functions.invoke("submit-precos", {
        body: { token, prices: priceEntries },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao enviar");
      }

      setSent(true);
      toast.success("Resposta enviada! Obrigado.");
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

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">📭</div>
          <h1 className="text-xl font-bold mb-2">Olá, {fornecedorNome}!</h1>
          <p className="text-muted-foreground">{errorMsg}</p>
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 Cotação de Preços</h1>
            <p className="text-sm opacity-80">{fornecedorNome} · {produtos.length} produtos</p>
            {lojaNome && <p className="text-xs opacity-70 mt-0.5">🏪 Loja: {lojaNome}</p>}
          </div>
          <button
            onClick={handleNoItems}
            disabled={sending || hasAnyPrice}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 mt-0.5 ${
              hasAnyPrice || sending
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-white text-red-600 hover:bg-red-50 shadow-sm"
            }`}
          >
            ❌ Não tenho itens
          </button>
        </div>
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
                onChange={(e) => handlePriceChange(p.cotacao_produto_id, e.target.value)}
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
