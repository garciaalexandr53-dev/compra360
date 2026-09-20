import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { maskCNPJ } from "@/lib/masks";
import { pastasDisponiveis } from "@/lib/adminHelpers";

interface OnboardingState {
  pedir_cnpj: boolean;
  pedir_pasta: boolean;
  pedir_consentimento: boolean;
  permite_skip: boolean;
  pasta: string[] | null;
  tipo_fornecedor: string | null;
}

interface Props {
  token: string;
  /** Informa ao pai que o representante pulou o CNPJ nesta sessão. */
  onSkipChange?: (skipped: boolean) => void;
}

const TEXTO_REDE =
  "Estamos pensando em uma função onde seu contato pode aparecer para outros supermercados da sua região que ainda não compram de você, para gerar novos negócios. Isso significa que esses novos clientes também vão ver há quanto tempo você está cadastrado e sua taxa de resposta às cotações. Você toparia participar dessa lista?";

const OnboardingFornecedorCard = ({ token, onSkipChange }: Props) => {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [duplicado, setDuplicado] = useState(false);
  const [pastas, setPastas] = useState<string[]>([]);
  const [consentimento, setConsentimento] = useState<"sim" | "nao" | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_supplier_onboarding_state", {
        _token: token,
      });
      if (!alive || error) return;
      const row = (Array.isArray(data) ? data[0] : data) as OnboardingState | undefined;
      if (row) setState(row);
    })();
    return () => {
      alive = false;
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [token]);

  const digits = cnpj.replace(/\D/g, "");
  const cnpjCompleto = digits.length === 14;

  // Checa duplicidade do CNPJ com debounce para revelar as linhas de produto.
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!cnpjCompleto) {
      setDuplicado(false);
      return;
    }
    checkTimer.current = setTimeout(async () => {
      const { data } = await supabase.rpc("checar_cnpj_duplicado", {
        _token: token,
        _cnpj: digits,
      });
      setDuplicado(data === true);
    }, 500);
  }, [digits, cnpjCompleto, token]);

  if (!state || hidden) return null;
  if (!state.pedir_cnpj && !state.pedir_consentimento && !done) return null;

  if (done) {
    return (
      <div className="mx-3 sm:mx-4 mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-200">
        ✅ Obrigado! Dados atualizados.
      </div>
    );
  }

  const mostrarPasta = state.pedir_cnpj && state.pedir_pasta && duplicado;
  const opcoesPasta = pastasDisponiveis(state.tipo_fornecedor);

  const togglePasta = (p: string) =>
    setPastas((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const podeSalvar = (state.pedir_cnpj && cnpjCompleto) || consentimento !== null;

  const salvar = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("salvar_dados_fornecedor", {
        _token: token,
        _cnpj: cnpjCompleto ? digits : null,
        _pasta: mostrarPasta && pastas.length > 0 ? pastas : null,
        _consentimento: consentimento,
      });
      if (error) throw error;
      if (cnpjCompleto) onSkipChange?.(false);
      setDone(true);
    } catch (e: any) {
      toast.error("Não foi possível salvar: " + (e?.message ?? "erro"));
    }
    setSaving(false);
  };

  const responderDepois = () => {
    onSkipChange?.(true);
    setHidden(true);
  };

  return (
    <div className="mx-3 sm:mx-4 mt-3 rounded-xl border bg-card p-3 sm:p-4 space-y-4 max-w-3xl md:mx-auto">
      <h2 className="text-sm sm:text-base font-bold">Complete o cadastro da sua empresa</h2>

      {state.pedir_cnpj && (
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium" htmlFor="onb-cnpj">
            CNPJ da empresa que você representa
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="onb-cnpj"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
              className="flex-1"
            />
            {state.permite_skip ? (
              <Button variant="outline" onClick={responderDepois} className="shrink-0">
                Responder depois
              </Button>
            ) : null}
          </div>
          {!state.permite_skip && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Para continuar recebendo cotações, complete o cadastro da sua empresa.
            </p>
          )}
        </div>
      )}

      {mostrarPasta && (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm font-medium">
            Quais linhas de produtos você atende?
          </p>
          <div className="flex flex-wrap gap-2">
            {opcoesPasta.map((p) => {
              const on = pastas.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePasta(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.pedir_consentimento && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">{TEXTO_REDE}</p>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "sim", label: "Sim" },
              { v: "nao", label: "Não" },
              { v: "nao", label: "Preciso pensar" },
            ] as const).map((op, i) => {
              const on =
                (i === 0 && consentimento === "sim") ||
                (i > 0 && consentimento === "nao" && selecionado === i);
              return (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => {
                    setConsentimento(op.v);
                    setSelecionado(i);
                  }}
                  className={`text-xs sm:text-sm px-4 py-2 rounded-lg border font-medium transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button onClick={salvar} disabled={!podeSalvar || saving} className="w-full sm:w-auto">
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

export default OnboardingFornecedorCard;
