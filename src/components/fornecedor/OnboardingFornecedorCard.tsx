import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { maskCNPJ } from "@/lib/masks";
import { pastasDisponiveis } from "@/lib/adminHelpers";
import CidadesAtendidasInput from "@/components/fornecedor/CidadesAtendidasInput";
import { adicionarCidade, dedupCidades } from "@/lib/cidades";
import type { Municipio } from "@/lib/cep";

interface OnboardingState {
  pedir_cnpj: boolean;
  pedir_pasta: boolean;
  pedir_consentimento: boolean;
  permite_skip: boolean;
  pasta: string[] | null;
  tipo_fornecedor: string | null;
  pedir_cidades: boolean;
  participa_rede: boolean;
  cidades: Municipio[] | null;
  cidade_loja: string | null;
  uf_loja: string | null;
}

interface Props {
  token: string;
  /** Cotação aberta — usada para sugerir a cidade da loja que enviou. */
  cotacaoId?: string | null;
  /** Informa ao pai que o representante pulou o CNPJ nesta sessão. */
  onSkipChange?: (skipped: boolean) => void;
  /** Abre o card apenas para atualizar as cidades atendidas. */
  modoCidades?: boolean;
  /** Avisa o pai que o representante participa da Rede (habilita o link de atualizar cidades). */
  onParticipaRede?: (participa: boolean) => void;
  /** Fecha o modo "somente cidades". */
  onFechar?: () => void;
}

const TEXTO_REDE =
  "🚀 Estamos desenvolvendo a Rede Compra360 para conectar fornecedores a novos supermercados da sua região.\n\nSeu contato e sua taxa de resposta poderão ser recomendados para que esses supermercados enviem cotações diretamente para você.\n\nDeseja participar e receber novas cotações?";


const OnboardingFornecedorCard = ({
  token,
  cotacaoId,
  onSkipChange,
  modoCidades = false,
  onParticipaRede,
  onFechar,
}: Props) => {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [duplicado, setDuplicado] = useState(false);
  const [pastas, setPastas] = useState<string[]>([]);
  const [consentimento, setConsentimento] = useState<"sim" | "nao" | null>(null);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [cidades, setCidades] = useState<Municipio[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_supplier_onboarding_state", {
        _token: token,
        _cotacao_id: cotacaoId ?? null,
      });
      if (!alive || error) return;
      const row = (Array.isArray(data) ? data[0] : data) as unknown as OnboardingState | undefined;
      if (!row) return;
      setState(row);
      onParticipaRede?.(row.participa_rede === true);
      const salvas = dedupCidades(Array.isArray(row.cidades) ? row.cidades : []);
      if (salvas.length > 0) {
        setCidades(salvas);
      } else if (row.cidade_loja) {
        setCidades(adicionarCidade([], { cidade: row.cidade_loja, uf: row.uf_loja ?? "" }));
      }
    })();
    return () => {
      alive = false;
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cotacaoId]);

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

  // Cidades: aparecem quando ele já participa e ainda não declarou nenhuma,
  // quando ele acabou de aceitar nesta sessão, ou no modo de atualização.
  const mostrarCidades =
    modoCidades || state.pedir_cidades || consentimento === "sim";

  if (!modoCidades && !state.pedir_cnpj && !state.pedir_consentimento && !state.pedir_cidades && !done) {
    return null;
  }

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

  const podeSalvar = modoCidades
    ? cidades.length > 0
    : (state.pedir_cnpj && cnpjCompleto) || consentimento !== null || cidades.length > 0;

  const salvar = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("salvar_dados_fornecedor", {
        _token: token,
        _cnpj: !modoCidades && cnpjCompleto ? digits : null,
        _pasta: !modoCidades && mostrarPasta && pastas.length > 0 ? pastas : null,
        _consentimento: modoCidades ? null : consentimento,
        _cidades: mostrarCidades
          ? cidades.map((m) => ({ cidade: m.cidade, uf: m.uf }))
          : null,
      });
      if (error) throw error;
      if (!modoCidades && cnpjCompleto) onSkipChange?.(false);
      setDone(true);
      onFechar?.();
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
      <h2 className="text-sm sm:text-base font-bold">
        {modoCidades ? "Cidades que você atende" : "Complete o cadastro da sua empresa"}
      </h2>

      {!modoCidades && state.pedir_cnpj && (
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

      {!modoCidades && mostrarPasta && (
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

      {!modoCidades && state.pedir_consentimento && (
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

      {mostrarCidades && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs sm:text-sm font-medium">Quais cidades você atende?</p>
          <p className="text-xs text-muted-foreground">
            Você pode adicionar quantas cidades quiser — inclua todas as cidades que você
            atende para receber cotações de novos supermercados nessas regiões.
          </p>
          <CidadesAtendidasInput cidades={cidades} onChange={setCidades} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={salvar} disabled={!podeSalvar || saving} className="w-full sm:w-auto">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        {modoCidades && onFechar && (
          <Button variant="outline" onClick={onFechar} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingFornecedorCard;
