import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";
import {
  BadgeCheck,
  Gift,
  Lock,
  MessageCircle,
  Smartphone,
  Star,
  Zap,
} from "lucide-react";

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
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Seo
        title="Rede de Fornecedores Compra360"
        description="Conectamos sua distribuidora ou representação a supermercados da sua região. Receba cotações direto no seu WhatsApp, sem mensalidade nem comissão."
        path="/seja-parceiro"
        image="/og-rede-fornecedores.jpg"
        imageAlt="Rede de Fornecedores Compra360 — cotações no seu WhatsApp"
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
            <Link to="/seja-parceiro/cadastro">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-400 text-white h-12 px-8 rounded-xl"
              >
                Quero receber cotações gratuitamente
              </Button>
            </Link>
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

      {/* Chamada final */}
      <section className="px-5 py-14">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Pronto para receber cotações?</h2>
          <p className="text-slate-400 text-sm mb-8">
            O cadastro é gratuito, leva menos de 2 minutos e você não precisa criar senha.
          </p>
          <Link to="/seja-parceiro/cadastro">
            <Button
              size="lg"
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
            >
              Fazer meu cadastro gratuito
            </Button>
          </Link>

          <p className="text-center text-sm text-slate-400 mt-8">
            Já é parceiro?{" "}
            <Link to="/parceiro" className="text-emerald-400 hover:underline font-semibold">
              Atualizar minhas cidades e dados
            </Link>
          </p>

          <p className="text-center text-sm text-slate-500 mt-6">
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
