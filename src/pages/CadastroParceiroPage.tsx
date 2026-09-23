import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import CidadesAtendidasInput from "@/components/fornecedor/CidadesAtendidasInput";
import type { Municipio } from "@/lib/cep";
import { maskTelefone, maskCNPJ, isCNPJValido, formatNomeEmpresa, formatNomePessoa, normalizeTelefone } from "@/lib/masks";
import { pastasDisponiveis } from "@/lib/adminHelpers";
import { mensagemConfirmacaoCadastro, linkSuporteComMensagem } from "@/lib/parceiro";
import { validarWhatsApp } from "@/lib/whatsappValidacao";
import { ArrowLeft, CheckCircle2, MapPin, MessageCircle } from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CadastroParceiroPage = () => {
  const [params] = useSearchParams();
  const conviteLoja = (() => {
    const c = params.get("c");
    return c && UUID_RE.test(c) ? c : null;
  })();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [representante, setRepresentante] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [pastas, setPastas] = useState<string[]>([]);
  const [cidades, setCidades] = useState<Municipio[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [jaCadastrado, setJaCadastrado] = useState<string | null>(null);

  /** Consulta discreta: avisa se o WhatsApp digitado ja existe na Rede. */
  const checarTelefone = async (valor: string) => {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length < 10 || validarWhatsApp(valor)) {
      setJaCadastrado(null);
      return;
    }
    const { data, error } = await supabase.rpc("whatsapp_parceiro_existe", { _telefone: valor });
    if (error) return;
    const resp = (data ?? {}) as { existe?: boolean; nome?: string };
    setJaCadastrado(resp.existe ? (resp.nome ?? "") : null);
  };

  const opcoesPasta = useMemo(() => pastasDisponiveis(tipo), [tipo]);

  const togglePasta = (p: string) =>
    setPastas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));

  const enviar = async () => {
    const erroFone = validarWhatsApp(telefone);
    if (erroFone) {
      toast.error(erroFone);
      return;
    }
    if (!representante.trim()) {
      toast.error("Informe o seu nome.");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome da sua empresa ou representação.");
      return;
    }
    if (!isCNPJValido(cnpj)) {
      toast.error("CNPJ incompleto.");
      return;
    }
    if (cidades.length === 0) {
      toast.error("Adicione ao menos uma cidade que você atende.");
      return;
    }
    if (jaCadastrado !== null) {
      toast.error(
        "Você já faz parte da Rede! Por segurança, atualize seus dados na área do parceiro.",
      );
      return;
    }

    setSalvando(true);
    const { data, error } = await supabase.rpc("cadastrar_fornecedor_parceiro", {
      _nome: formatNomeEmpresa(nome),
      _representante: formatNomePessoa(representante),
      _telefone: normalizeTelefone(telefone),
      _cnpj: cnpj || null,
      _tipo: tipo,
      _pastas: pastas.length ? pastas : null,
      _cidades: cidades.map((c) => ({ cidade: c.cidade, uf: c.uf ?? "" })),
      _convite_loja: conviteLoja,
    });
    setSalvando(false);

    if (error) {
      toast.error("Não foi possível concluir o cadastro. Confira os dados e tente de novo.");
      return;
    }
    const resp = (data ?? {}) as { status?: string; codigo?: string };
    if (resp.status === "ja_cadastrado") {
      setJaCadastrado("");
      toast.error(
        "Este WhatsApp já está cadastrado na Rede. Atualize seus dados na área do parceiro.",
      );
      return;
    }
    setCodigo(resp.codigo ?? null);
    setPronto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (pronto) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center px-5 py-16">
        <Seo
          title="Cadastro concluído — Rede Compra360"
          description="Seu cadastro na Rede Compra360 foi concluído. Agora você pode receber cotações de supermercados da sua região."
          path="/seja-parceiro/cadastro"
          noindex
        />
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Cadastro concluído!</h1>
          <p className="text-slate-400 mb-6">
            Seu contato já está na Rede Compra360. Assim que um supermercado da sua região abrir uma
            cotação, o link chega no seu WhatsApp — sem senha, sem cadastro, direto no celular.
          </p>
          {codigo && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 mb-6 text-left">
              <p className="text-sm font-semibold text-white mb-1">
                Falta 1 passo: confirme seu WhatsApp
              </p>
              <p className="text-sm text-slate-400 mb-4">
                Toque no botão abaixo e envie a mensagem já pronta. É assim que garantimos que o
                número é realmente seu.
              </p>
              <div className="rounded-xl bg-slate-950 border border-white/10 py-4 text-center mb-4">
                <p className="text-xs text-slate-500 mb-1">Seu código</p>
                <p className="text-4xl font-bold tracking-[0.4em] text-white">{codigo}</p>
              </div>
              <a
                href={linkSuporteComMensagem(
                  mensagemConfirmacaoCadastro(representante, nome, codigo),
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold">
                  <MessageCircle className="h-5 w-5 mr-2" /> Confirmar no WhatsApp
                </Button>
              </a>
            </div>
          )}
          <p className="text-sm text-slate-500 mb-8">
            Precisa atualizar suas cidades depois?{" "}
            <Link to="/parceiro" className="text-emerald-400 hover:underline">
              Atualize seus dados aqui
            </Link>{" "}
            ou fale com a gente pelo WhatsApp{" "}
            <a
              href="https://wa.me/5544984483553"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline whitespace-nowrap"
            >
              (44) 98448-3553
            </a>
            .
          </p>
          <Link to="/" className="text-sm text-slate-400 hover:text-white underline">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Seo
        title="Cadastro de parceiro — Rede Compra360"
        description="Preencha seus dados e entre gratuitamente na Rede Compra360 para receber cotações de supermercados da sua região."
        path="/seja-parceiro/cadastro"
      />

      <section className="px-5 py-12">
        <div className="max-w-xl mx-auto">
          <Link
            to="/seja-parceiro"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Cadastre-se na Rede Compra360
          </h1>
          <p className="text-slate-400 text-center text-sm mb-8">
            Gratuito, leva menos de 2 minutos e você não precisa criar senha.
          </p>

          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300">WhatsApp *</Label>
              <Input
                value={telefone}
                onChange={(e) => {
                  const v = maskTelefone(e.target.value);
                  setTelefone(v);
                  void checarTelefone(v);
                }}
                onBlur={(e) => void checarTelefone(e.target.value)}
                placeholder="(44) 99999-9999"
                inputMode="numeric"
                autoFocus
                className={`bg-slate-950 text-white ${
                  jaCadastrado !== null ? "border-amber-500/60" : "border-white/10"
                }`}
              />
              {jaCadastrado !== null ? (
                <p className="text-xs text-amber-300 leading-relaxed">
                  Este WhatsApp já está cadastrado na Rede Compra360
                  {jaCadastrado ? ` (${jaCadastrado})` : ""}. Para alterar suas cidades ou linhas de
                  atendimento,{" "}
                  <Link to="/parceiro" className="underline font-semibold text-amber-200">
                    atualize seus dados aqui
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  É nele que você vai receber os links das cotações.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Seu nome *</Label>
              <Input
                value={representante}
                onChange={(e) => setRepresentante(e.target.value)}
                placeholder="Ex: João Silva"
                className="bg-slate-950 border-white/10 text-white"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Nome da empresa ou representação *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="EX: DISTRIBUIDORA SOL"
                className="uppercase bg-slate-950 border-white/10 text-white"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">CNPJ (opcional)</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                className="bg-slate-950 border-white/10 text-white"
              />
            </div>


            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de fornecedor</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  {
                    value: "geral",
                    label: "Geral",
                    desc: "Atacado e distribuição com sortimento amplo.",
                  },
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
                      <Checkbox
                        checked={pastas.includes(p)}
                        onCheckedChange={() => togglePasta(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-teal-400" /> Cidades que você atende *
              </Label>
              <p className="text-xs text-slate-500">
                Adicione quantas cidades quiser — digite as duas primeiras letras e escolha na lista.
              </p>
              <CidadesAtendidasInput
                cidades={cidades}
                onChange={setCidades}
                placeholder="Digite a cidade (ex.: Jus...)"
                inputClassName="!bg-slate-950 !text-white border-white/20 placeholder:!text-slate-500"
              />
            </div>

            <Button
              onClick={enviar}
              disabled={salvando}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
            >
              {salvando ? "Salvando..." : "Salvar informações e participar"}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Ao cadastrar, você autoriza que seu contato e sua taxa de resposta sejam recomendados a
              supermercados da sua região para enviarem cotações a você.
            </p>
          </div>

          <p className="text-center text-sm text-slate-400 mt-6">
            Já é parceiro?{" "}
            <Link to="/parceiro" className="text-emerald-400 hover:underline font-semibold">
              Atualizar minhas cidades e dados
            </Link>
          </p>

          <p className="text-center text-sm text-slate-500 mt-8">
            Dúvidas? Fale com a gente no WhatsApp
            <br />
            <a
              href="https://wa.me/5544984483553"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline whitespace-nowrap font-semibold"
            >
              (44)&nbsp;98448-3553
            </a>
          </p>
        </div>
      </section>
    </div>
  );
};

export default CadastroParceiroPage;
