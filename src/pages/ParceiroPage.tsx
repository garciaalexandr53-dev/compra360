import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import CidadesAtendidasInput from "@/components/fornecedor/CidadesAtendidasInput";
import type { Municipio } from "@/lib/cep";
import { maskTelefone, formatNomeEmpresa, formatNomePessoa } from "@/lib/masks";
import { pastasDisponiveis } from "@/lib/adminHelpers";
import { validarWhatsApp } from "@/pages/SejaParceiroPage";
import { mensagemAcessoParceiro, linkSuporteComMensagem } from "@/lib/parceiro";
import { Loader2, MessageCircle, ShieldCheck, CheckCircle2 } from "lucide-react";

type Dados = {
  encontrado: boolean;
  nome?: string;
  representante?: string | null;
  telefone?: string | null;
  tipo_fornecedor?: string | null;
  pasta?: string[] | null;
  cidades?: { cidade: string; uf: string }[];
};

const campoEscuro = "bg-slate-950 border-white/10 text-white";

/** Tela em que o representante pede acesso digitando o WhatsApp. */
function PedirAcesso() {
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  const pedir = async () => {
    const erro = validarWhatsApp(telefone);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    const { data, error } = await supabase.rpc("solicitar_acesso_parceiro", { _telefone: telefone });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível gerar seu código agora. Tente novamente.");
      return;
    }
    const resp = (data ?? {}) as { encontrado?: boolean; nome?: string; codigo?: string };
    if (!resp.encontrado) {
      toast.error("Não encontramos esse WhatsApp na Rede. Faça seu cadastro primeiro.");
      return;
    }
    setNome(resp.nome ?? "");
    setCodigo(resp.codigo ?? null);
  };

  if (codigo) {
    const msg = mensagemAcessoParceiro(nome, codigo);
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
          <ShieldCheck className="h-8 w-8 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Confirme que é você</h1>
        <p className="text-slate-400 mb-6">
          Para proteger seus dados, só o dono do WhatsApp pode alterar o cadastro. Toque no botão
          abaixo e envie a mensagem já pronta — devolvemos seu link de acesso no mesmo WhatsApp.
        </p>
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 mb-6">
          <p className="text-xs text-slate-500 mb-1">Seu código de segurança</p>
          <p className="text-4xl font-bold tracking-[0.4em] text-white">{codigo}</p>
        </div>
        <a href={linkSuporteComMensagem(msg)} target="_blank" rel="noopener noreferrer">
          <Button className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold">
            <MessageCircle className="h-5 w-5 mr-2" /> Confirmar no WhatsApp
          </Button>
        </a>
        <Link to="/" className="block mt-8 text-sm text-slate-400 hover:text-white underline">
          Voltar para a página inicial
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white text-center mb-2">Atualizar meus dados</h1>
      <p className="text-slate-400 text-center text-sm mb-8">
        Sem senha: informe o WhatsApp cadastrado e confirme que é você em um toque.
      </p>
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Seu WhatsApp</Label>
          <Input
            value={telefone}
            onChange={(e) => setTelefone(maskTelefone(e.target.value))}
            placeholder="(44) 99999-9999"
            inputMode="numeric"
            className={campoEscuro}
          />
        </div>
        <Button
          onClick={pedir}
          disabled={enviando}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
        >
          {enviando ? "Gerando código..." : "Continuar"}
        </Button>
        <p className="text-xs text-slate-500 text-center">
          Ainda não é parceiro?{" "}
          <Link to="/seja-parceiro" className="text-emerald-400 hover:underline">
            Cadastre-se gratuitamente
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** Tela de edição dos dados pelo link exclusivo do parceiro. */
function EditarDados({ token }: { token: string }) {
  const [carregando, setCarregando] = useState(true);
  const [valido, setValido] = useState(true);
  const [nome, setNome] = useState("");
  const [representante, setRepresentante] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [pastas, setPastas] = useState<string[]>([]);
  const [cidades, setCidades] = useState<Municipio[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const opcoesPasta = useMemo(() => pastasDisponiveis(tipo), [tipo]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_parceiro_dados", { _token: token });
      if (!ativo) return;
      const resp = (data ?? {}) as Dados;
      if (error || !resp.encontrado) {
        setValido(false);
        setCarregando(false);
        return;
      }
      setNome(resp.nome ?? "");
      setRepresentante(resp.representante ?? "");
      setTelefone(maskTelefone(resp.telefone ?? ""));
      setTipo(resp.tipo_fornecedor || "geral");
      setPastas(resp.pasta ?? []);
      setCidades((resp.cidades ?? []).map((c) => ({ cidade: c.cidade, uf: c.uf })));
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  const togglePasta = (p: string) =>
    setPastas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));

  const salvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da sua empresa ou representação.");
      return;
    }
    if (cidades.length === 0) {
      toast.error("Adicione ao menos uma cidade que você atende.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.rpc("salvar_parceiro_dados", {
      _token: token,
      _nome: formatNomeEmpresa(nome),
      _representante: formatNomePessoa(representante),
      _tipo: tipo,
      _pastas: tipo === "especializado" ? pastas : [],
      _cidades: cidades.map((c) => ({ cidade: c.cidade, uf: c.uf ?? "" })),
    });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar. Confira os dados e tente de novo.");
      return;
    }
    setSalvo(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!valido) {
    return (
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Link inválido</h1>
        <p className="text-slate-400 mb-6">
          Esse link de acesso não é mais válido. Peça um novo acesso informando seu WhatsApp.
        </p>
        <Link to="/parceiro">
          <Button className="bg-emerald-500 hover:bg-emerald-400 text-white h-12 px-6 rounded-xl">
            Pedir novo acesso
          </Button>
        </Link>
      </div>
    );
  }

  if (salvo) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Dados atualizados!</h1>
        <p className="text-slate-400 mb-6">
          Suas cidades e linhas já valem para as próximas cotações dos supermercados da região.
        </p>
        <Button
          variant="outline"
          onClick={() => setSalvo(false)}
          className="border-white/20 text-slate-200 hover:bg-white/5"
        >
          Editar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white text-center mb-2">Meus dados na Rede</h1>
      <p className="text-slate-400 text-center text-sm mb-8">
        Atualize as cidades que você atende e as linhas que representa quando quiser.
      </p>

      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="space-y-2">
          <Label className="text-slate-300">Nome da empresa ou representação *</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`uppercase ${campoEscuro}`}
            maxLength={120}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Seu nome</Label>
            <Input
              value={representante}
              onChange={(e) => setRepresentante(e.target.value)}
              className={campoEscuro}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">WhatsApp</Label>
            <Input value={telefone} readOnly className={`${campoEscuro} opacity-70`} />
            <p className="text-[11px] text-slate-500">
              Para trocar o número, fale com a gente pelo WhatsApp do suporte.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Tipo de fornecedor</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { value: "geral", label: "Geral", desc: "Atacado e distribuição com sortimento amplo." },
              {
                value: "especializado",
                label: "Especializado",
                desc: "Atua em linhas específicas (bebidas, carnes, frios...).",
              },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTipo(t.value);
                  if (t.value !== "especializado") setPastas([]);
                }}
                className={`text-left rounded-xl px-4 py-3 border transition-colors ${
                  tipo === t.value
                    ? "bg-teal-500/15 border-teal-400 text-white"
                    : "bg-slate-950 border-white/10 text-slate-300 hover:border-teal-500/40"
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {tipo === "especializado" && (
          <div className="space-y-2">
            <Label className="text-slate-300">Linhas que você vende</Label>
            <div className="grid grid-cols-2 gap-2">
              {opcoesPasta.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 text-sm text-slate-300 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <Checkbox checked={pastas.includes(p)} onCheckedChange={() => togglePasta(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-slate-300">Cidades que você atende *</Label>
          <CidadesAtendidasInput
            cidades={cidades}
            onChange={setCidades}
            placeholder="Digite a cidade (ex.: Jus...)"
            inputClassName="!bg-slate-950 !text-white border-white/20 placeholder:!text-slate-500"
          />
        </div>

        <Button
          onClick={salvar}
          disabled={salvando}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
        >
          {salvando ? "Salvando..." : "Salvar meus dados"}
        </Button>
      </div>
    </div>
  );
}

const ParceiroPage = () => {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-5 py-14">
      <Seo
        title="Área do parceiro — Rede Compra360"
        description="Atualize as cidades que você atende e as linhas que representa na Rede Compra360."
        path="/parceiro"
        noindex
      />
      {token ? <EditarDados token={token} /> : <PedirAcesso />}
    </div>
  );
};

export default ParceiroPage;
