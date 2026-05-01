import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNumber, formatHoraLocal, formatTimeRemaining } from "@/lib/format";

interface ProdutoItem {
  cotacao_produto_id: string;
  nome: string;
  embalagem: string;
  quantidade: number;
}

type ScreenState = "loading" | "invalid" | "closed" | "expired" | "empty" | "ready" | "sent";

const FornecedorCotacaoPage = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const lojaParam = searchParams.get("loja");
  const [screen, setScreen] = useState<ScreenState>("loading");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [lojaNome, setLojaNome] = useState("");
  const [produtos, setProdutos] = useState<ProdutoItem[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [prazoIso, setPrazoIso] = useState<string | null>(null);
  const [cotacaoId, setCotacaoId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const visualizadoMarcado = useRef(false);

  const hasAnyPrice = Object.values(prices).some((v) => v.trim().length > 0);

  // Tick every 60s to refresh countdown / detect expiration
  useEffect(() => {
    if (screen !== "ready" || !prazoIso) return;
    const i = setInterval(() => {
      forceTick((t) => t + 1);
      if (new Date(prazoIso).getTime() <= Date.now()) setScreen("expired");
    }, 60_000);
    return () => clearInterval(i);
  }, [screen, prazoIso]);

  // Realtime: comprador alterou prazo → atualiza
  useEffect(() => {
    if (!cotacaoId) return;
    const ch = supabase
      .channel(`cot-prazo-${cotacaoId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cotacoes", filter: `id=eq.${cotacaoId}` }, (payload: any) => {
        const novo = payload.new?.prazo_resposta ?? null;
        setPrazoIso(novo);
        if (novo && new Date(novo).getTime() <= Date.now()) setScreen("expired");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cotacaoId]);

  useEffect(() => {
    if (!token) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const log = (...args: any[]) => {
    // Keeps a trail in mobile remote devtools to debug "0 produtos" issues
    // eslint-disable-next-line no-console
    console.log("[FornecedorCotacao]", ...args);
  };

  const loadData = async () => {
    setScreen("loading");
    setErrorMsg("");
    try {
      // 1. Validate token → supplier
      const { data: supplierInfo, error: fErr } = await supabase.rpc("get_supplier_info", {
        _token: token!,
      });
      const supplier = supplierInfo?.[0];
      log("supplier", { supplier, fErr });
      if (fErr || !supplier) {
        setScreen("invalid");
        return;
      }
      setFornecedorId(supplier.id);
      setFornecedorNome(supplier.nome);

      // 2. Use SECURITY DEFINER RPC to find the right cotação for this supplier,
      //    bypassing RLS so we can correctly detect 'finalizada'/'cancelada' status.
      const { data: statusRows, error: statusErr } = await supabase.rpc(
        "get_cotacao_status_for_supplier",
        { _token: token!, _loja_id: lojaParam || null }
      );
      log("status rows", { statusRows, statusErr });

      const row = statusRows?.[0];

      if (!row) {
        setErrorMsg(
          "Nenhuma cotação foi encontrada para você no momento. Se acredita que isso é um erro, entre em contato com o solicitante."
        );
        setScreen("empty");
        return;
      }

      if (row.loja_nome) setLojaNome(row.loja_nome);
      setCotacaoId(row.cotacao_id);
      setPrazoIso(row.prazo_resposta || null);

      if (row.status !== "ativa") {
        setScreen("closed");
        return;
      }

      // Auto-expire when prazo passed
      if (row.prazo_resposta && new Date(row.prazo_resposta).getTime() <= Date.now()) {
        setScreen("expired");
        return;
      }

      const cotacaoId = row.cotacao_id;

      // Mark visualization (idempotent, fire-and-forget)
      if (!visualizadoMarcado.current) {
        visualizadoMarcado.current = true;
        supabase.rpc("marcar_cotacao_visualizada", { _token: token!, _cotacao_id: cotacaoId })
          .then(({ error }) => { if (error) log("marcar_visualizada err", error); });
      }

      // 3. Load products (anon RLS allows because status='ativa')
      // Retry once on transient mobile network errors.
      const fetchProdutos = async () =>
        await supabase
          .from("cotacao_produtos")
          .select("id, quantidade, produtos(nome, embalagem)")
          .eq("cotacao_id", cotacaoId);

      let { data: cpData, error: cpErr } = await fetchProdutos();
      if (cpErr || !cpData) {
        log("retry cotacao_produtos", cpErr);
        await new Promise((r) => setTimeout(r, 600));
        const retry = await fetchProdutos();
        cpData = retry.data;
        cpErr = retry.error;
      }
      log("produtos loaded", { count: cpData?.length, cpErr });

      if (!cpData || cpData.length === 0) {
        setErrorMsg(
          "A cotação está ativa, mas nenhum produto foi adicionado a ela ainda. Tente novamente em alguns minutos."
        );
        setScreen("empty");
        return;
      }

      const items = cpData
        .map((cp: any) => ({
          cotacao_produto_id: cp.id,
          nome: cp.produtos?.nome || "?",
          embalagem: cp.produtos?.embalagem || "un",
          quantidade: cp.quantidade || 1,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setProdutos(items);

      // 4. Load existing prices
      const cpIds = items.map((it) => it.cotacao_produto_id);
      const { data: existingPrices } = await supabase
        .from("precos")
        .select("cotacao_produto_id, preco")
        .eq("fornecedor_id", supplier.id)
        .in("cotacao_produto_id", cpIds);

      if (existingPrices) {
        const p: Record<string, string> = {};
        existingPrices.forEach((ep: any) => {
          if (ep.preco !== null && ep.preco > 0) p[ep.cotacao_produto_id] = formatNumber(ep.preco);
        });
        setPrices(p);
      }

      setScreen("ready");
    } catch (e: any) {
      log("fatal", e);
      setErrorMsg("Erro ao carregar a cotação. Verifique sua conexão e tente novamente.");
      setScreen("empty");
    }
  };

  const formatCurrency = (raw: string): string => {
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

      setScreen("sent");
      toast.success("Preços enviados com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    }
    setSending(false);
  };

  const handleNoItems = async () => {
    setSending(true);
    try {
      const priceEntries = produtos.map((p) => ({
        cotacao_produto_id: p.cotacao_produto_id,
        preco: 0,
      }));

      const { data, error } = await supabase.functions.invoke("submit-precos", {
        body: { token, prices: priceEntries },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao enviar");
      }

      setScreen("sent");
      toast.success("Resposta enviada! Obrigado.");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    }
    setSending(false);
  };

  // ============ Shared shells ============
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );

  const BrandLogo = () => (
    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-dark))] to-[hsl(var(--brand-light))] shadow-lg">
      <span className="text-white text-2xl font-bold">C360</span>
    </div>
  );

  // ============ Screens ============
  if (screen === "loading") {
    return (
      <Shell>
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </Shell>
    );
  }

  if (screen === "invalid") {
    return (
      <Shell>
        <BrandLogo />
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-bold mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link de cotação não é válido ou expirou.</p>
        <p className="text-xs text-muted-foreground mt-6">Compra360</p>
      </Shell>
    );
  }

  if (screen === "closed") {
    return (
      <Shell>
        <BrandLogo />
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold mb-3">Cotação encerrada</h1>
        <p className="text-muted-foreground leading-relaxed">
          Olá{fornecedorNome ? `, ${fornecedorNome}` : ""}! Esta cotação já foi encerrada e não está
          mais aceitando preços.
        </p>
        <p className="text-muted-foreground mt-3">Obrigado pela sua participação! 🙌</p>
        {lojaNome && (
          <p className="text-xs text-muted-foreground mt-4">🏪 {lojaNome}</p>
        )}
        <p className="text-xs text-muted-foreground mt-8 opacity-70">Compra360 · compra360app.com.br</p>
      </Shell>
    );
  }

  if (screen === "empty") {
    return (
      <Shell>
        <BrandLogo />
        <div className="text-4xl mb-4">📭</div>
        <h1 className="text-xl font-bold mb-2">Olá{fornecedorNome ? `, ${fornecedorNome}` : ""}!</h1>
        <p className="text-muted-foreground">{errorMsg}</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => loadData()}
        >
          🔄 Tentar novamente
        </Button>
        <p className="text-xs text-muted-foreground mt-8 opacity-70">Compra360</p>
      </Shell>
    );
  }

  if (screen === "sent") {
    return (
      <Shell>
        <BrandLogo />
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold mb-2">Preços Enviados!</h1>
        <p className="text-muted-foreground">
          Obrigado, {fornecedorNome}! Seus preços foram recebidos.
        </p>
        <p className="text-xs text-muted-foreground mt-8 opacity-70">Compra360</p>
      </Shell>
    );
  }

  // ============ Ready (cotação ativa) ============
  const filledCount = Object.values(prices).filter((v) => v.trim()).length;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white p-4 sm:p-5 sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold truncate">📋 Cotação de Preços</h1>
            <p className="text-xs sm:text-sm opacity-80 truncate">
              {fornecedorNome} · {produtos.length} produtos
            </p>
            {lojaNome && (
              <p className="text-[11px] sm:text-xs opacity-70 mt-0.5 truncate">🏪 {lojaNome}</p>
            )}
          </div>
          <button
            onClick={handleNoItems}
            disabled={sending || hasAnyPrice}
            className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 mt-0.5 whitespace-nowrap ${
              hasAnyPrice || sending
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-white text-red-600 hover:bg-red-50 shadow-sm"
            }`}
          >
            ❌ Sem itens
          </button>
        </div>
      </div>

      {/* Products */}
      <div className="p-3 sm:p-4 space-y-3 max-w-3xl mx-auto">
        {produtos.map((p, i) => (
          <div
            key={p.cotacao_produto_id}
            className="bg-card border rounded-xl p-3 sm:p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs text-muted-foreground shrink-0">{i + 1}.</span>
              <span className="text-xs text-muted-foreground truncate text-right">
                {p.embalagem} · {p.quantidade} un
              </span>
            </div>
            <div className="font-semibold text-sm mb-3 break-words">{p.nome}</div>
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
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-3 sm:p-4 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={handleSend}
            disabled={sending || filledCount === 0}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm sm:text-base py-5 sm:py-6 font-bold"
          >
            {sending ? "Enviando..." : `✅ Enviar ${filledCount} Preços`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FornecedorCotacaoPage;
