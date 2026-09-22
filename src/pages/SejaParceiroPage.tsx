import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import CidadesAtendidasInput from "@/components/fornecedor/CidadesAtendidasInput";
import type { Municipio } from "@/lib/cep";
import { maskTelefone, maskCNPJ, isCNPJValido, formatNomeEmpresa, formatNomePessoa } from "@/lib/masks";
import { pastasDisponiveis } from "@/lib/adminHelpers";
import {
  BadgeCheck,
  CheckCircle2,
  Gift,
  Lock,
  MapPin,
  MessageCircle,
  Smartphone,
  Star,
  Zap,
} from "lucide-react";

/** DDDs válidos no Brasil. */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68,
  69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95,
  96, 97, 98, 99,
]);

const SEQUENCIAS_FALSAS = ["0123456789", "1234567890", "9876543210", "12345678"];

/** Validação estrutural do WhatsApp (DDD, 9º dígito e sequências óbvias). */
export function validarWhatsApp(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length < 10) return "Informe o WhatsApp com DDD.";
  if (d.length > 11) return "WhatsApp com dígitos demais.";
  const ddd = Number(d.slice(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return "DDD inexistente no Brasil.";
  const numero = d.slice(2);
  if (numero.length === 9 && numero[0] !== "9") return "Celular deve começar com 9 depois do DDD.";
  if (/^(\d)\1+$/.test(numero)) return "Número inválido.";
  if (SEQUENCIAS_FALSAS.some((s) => numero.includes(s))) return "Número inválido.";
  return null;
}

const DIFERENCIAIS = [
  {
    icon: Zap,
    title: "Sem cadastro e sem senha",
    desc: "Você recebe o link da cotação no WhatsApp, abre e digita os preços. Nada de portal, login ou senha esquecida.",
  },
  {
    icon: Smartphone,
    title: "Responde em 1 minuto pelo celular",
    desc: "Muito mais rápido que planilha, foto de caderno ou lista no papel.",
  },
  {
    icon: MessageCircle,
    title: "O pedido chega pronto",
    desc: "Ganhou o item? O pedido chega organizado com quantidade e embalagem para você faturar direto com o mercado.",
  },
  {
    icon: Lock,
    title: "Seus preços são sigilosos",
    desc: "Só o comprador daquela cotação vê o que você enviou. Nenhum concorrente tem acesso.",
  },
];

const PASSOS = [
  {
    n: "1",
    title: "Informe suas cidades e pastas",
    desc: "Diga em quais cidades você entrega e quais linhas de produto você representa. Leva menos de 2 minutos.",
  },
  {
    n: "2",
    title: "Receba cotações no WhatsApp",
    desc: "Quando um mercado da sua região abrir cotação, o link chega direto no seu celular.",
  },
  {
    n: "3",
    title: "Responda e feche vendas",
    desc: "Preencha seus preços e receba os pedidos confirmados para faturar com o cliente.",
  },
];

const DEPOIMENTOS = [
  {
    texto:
      "O melhor sistema de cotação que já usei. Não preciso de senha nem de computador, abro no celular e passo os preços em dois minutos.",
    autor: "Representante de alimentos e bebidas",
  },
  {
    texto:
      "O pedido vem certinho com quantidade e embalagem no WhatsApp. Economiza um tempo enorme no fechamento.",
    autor: "Distribuidor regional",
  },
];

const SejaParceiroPage = () => {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [representante, setRepresentante] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [pastas, setPastas] = useState<string[]>([]);
  const [cidades, setCidades] = useState<Municipio[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  const opcoesPasta = useMemo(() => pastasDisponiveis(tipo), [tipo]);

  const togglePasta = (p: string) =>
    setPastas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));

  const enviar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da sua empresa ou representação.");
      return;
    }
    if (!representante.trim()) {
      toast.error("Informe o seu nome.");
      return;
    }
    const erroFone = validarWhatsApp(telefone);
    if (erroFone) {
      toast.error(erroFone);
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

    setSalvando(true);
    const { error } = await supabase.rpc("cadastrar_fornecedor_parceiro", {
      _nome: formatNomeEmpresa(nome),
      _representante: formatNomePessoa(representante),
      _telefone: telefone,
      _cnpj: cnpj || null,
      _tipo: tipo,
      _pastas: pastas.length ? pastas : null,
      _cidades: cidades.map((c) => ({ cidade: c.cidade, uf: c.uf ?? "" })),
    });
    setSalvando(false);

    if (error) {
      toast.error("Não foi possível concluir o cadastro. Confira os dados e tente de novo.");
      return;
    }
    setPronto(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (pronto) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center px-5 py-16">
        <Seo
          title="Cadastro concluído — Rede Compra360"
          description="Seu cadastro na Rede Compra360 foi concluído. Agora você pode receber cotações de supermercados da sua região."
          path="/seja-parceiro"
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
          <p className="text-sm text-slate-500 mb-8">
            Precisa incluir mais cidades depois? Fale com a gente pelo WhatsApp{" "}
            <a
              href="https://wa.me/5544984483553"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
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
        title="Seja parceiro da Rede Compra360 — receba cotações de supermercados"
        description="Cadastro gratuito para distribuidores e representantes: receba cotações de supermercados da sua região no WhatsApp, sem senha e sem mensalidade."
        path="/seja-parceiro"
      />

      {/* Topo */}
      <section className="px-5 pt-14 pb-12 border-b border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-5">
            <Gift className="h-3.5 w-3.5" /> 100% gratuito para fornecedores
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
            Receba cotações de supermercados da sua região direto no seu WhatsApp
          </h1>
          <p className="text-slate-400 text-base sm:text-lg mb-6">
            Cadastre as cidades que você atende e as linhas que você representa na Rede Compra360 e
            venda para novos mercados sem bater de porta em porta.
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-400" /> Sem mensalidade
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-400" /> Sem comissão sobre suas vendas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald-400" /> Sem taxa de adesão
            </span>
          </div>
          <div className="mt-8">
            <a href="#cadastro">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-400 text-white h-12 px-8 rounded-xl"
              >
                Quero receber cotações gratuitamente
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="px-5 py-14 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            Por que os representantes gostam do Compra360
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {DIFERENCIAIS.map((d) => (
              <div
                key={d.title}
                className="bg-slate-900/60 border border-white/5 rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
                  <d.icon className="h-5 w-5 text-teal-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{d.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="px-5 py-14 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Como funciona</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {PASSOS.map((p) => (
              <div key={p.n} className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center mb-4">
                  {p.n}
                </div>
                <h3 className="font-bold text-white mb-2">{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="px-5 py-14 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            O que dizem os fornecedores que já usam
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {DEPOIMENTOS.map((d) => (
              <div key={d.autor} className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">"{d.texto}"</p>
                <p className="text-slate-500 text-xs">{d.autor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section id="cadastro" className="px-5 py-14">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Cadastre-se na Rede Compra360
          </h2>
          <p className="text-slate-400 text-center text-sm mb-8">
            Gratuito, leva menos de 2 minutos e você não precisa criar senha.
          </p>

          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-5">
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

            <div className="grid sm:grid-cols-2 gap-4">
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
                <Label className="text-slate-300">WhatsApp *</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                  placeholder="(44) 99999-9999"
                  inputMode="numeric"
                  className="bg-slate-950 border-white/10 text-white"
                />
              </div>
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
              {salvando ? "Enviando..." : "Quero receber novas cotações gratuitamente"}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Ao cadastrar, você autoriza que seu contato e sua taxa de resposta sejam recomendados a
              supermercados da sua região para enviarem cotações a você.
            </p>
          </div>

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

export default SejaParceiroPage;
