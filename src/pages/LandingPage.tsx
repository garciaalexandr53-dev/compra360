import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_PRICES } from "@/lib/planPrices";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Send,
  Zap,
  Trophy,
  Star,
  Check,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Shield,
  Smartphone,
  Clock,
  TrendingDown,
  Users,
  Package,
  Brain,
} from "lucide-react";

/* ── helpers ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const anim = (visible: boolean, delay = 0) =>
  `transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${delay ? `delay-[${delay}ms]` : ""}`;

/* ── Animated counter ── */
function AnimatedCounter({ target, suffix = "", visible }: { target: number; suffix?: string; visible: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 1500;
    const step = Math.ceil(target / (duration / 30));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [visible, target]);
  return <>{count.toLocaleString("pt-BR")}{suffix}</>;
}

/* ── data ── */
const steps = [
  { icon: Send, title: "Monte e Envie", desc: "Crie sua lista de produtos e compartilhe o link com seus fornecedores via WhatsApp em segundos." },
  { icon: Zap, title: "Receba os Preços", desc: "Os fornecedores preenchem os preços diretamente no celular — sem app, sem cadastro, sem complicação." },
  { icon: Trophy, title: "Compre Melhor", desc: "O sistema compara tudo automaticamente e destaca o melhor preço. Você fecha o pedido em minutos." },
];

const benefits = [
  { icon: TrendingDown, title: "Economize até 20%", desc: "Compare preços lado a lado e compre sempre do fornecedor mais barato, automaticamente." },
  { icon: Clock, title: "Cotação em minutos", desc: "Chega de horas ao telefone pedindo preço. Seus fornecedores preenchem online, quando puderem." },
  { icon: Smartphone, title: "100% pelo celular", desc: "Funciona no navegador do celular. Sem instalar nada, sem computador obrigatório." },
  { icon: Brain, title: "IA integrada", desc: "Inteligência artificial analisa preços, sugere fornecedores e classifica produtos para você." },
  { icon: Shield, title: "Dados protegidos", desc: "Nenhum fornecedor vê o preço do concorrente. Suas cotações são privadas e criptografadas." },
  { icon: Users, title: "Equipe conectada", desc: "Funcionários registram itens faltantes pelo celular. Tudo chega na sua lista automaticamente." },
];

const stats = [
  { value: 2000, suffix: "+", label: "Produtos no catálogo" },
  { value: 47, suffix: "", label: "Empresas ativas" },
  { value: 20, suffix: "%", label: "Economia média" },
  { value: 5, suffix: "min", label: "Tempo médio de cotação" },
];

const testimonials = [
  {
    text: "Pelo celular é muito rápido. É o sistema mais prático que já vi. Para o vendedor mais antigo, é uma mão na roda.",
    name: "Bruno",
    role: "Representante Comercial",
    company: "Destrinho",
    color: "bg-teal-500",
  },
  {
    text: "Mais prático que planilha de Excel. O sistema é rápido e ajuda a não ter erro no pedido.",
    name: "Marquinhos",
    role: "Representante Comercial",
    company: "Fornecedor Campeão",
    color: "bg-emerald-500",
  },
  {
    text: "Antes eu levava 2 dias fazendo cotação. Agora mando o link e no dia seguinte já tenho todos os preços.",
    name: "Patrícia",
    role: "Compradora",
    company: "Minimercado Bom Preço",
    color: "bg-cyan-500",
  },
  {
    text: "A IA sugere o melhor fornecedor por produto. Isso me poupa muito tempo de análise toda semana.",
    name: "Ricardo",
    role: "Gerente de Compras",
    company: "Rede SuperFácil",
    color: "bg-indigo-500",
  },
];

const plans = [
  {
    name: "Gratuito",
    price: "R$0",
    period: "/mês",
    highlight: false,
    badge: null,
    oldPrice: null,
    features: ["Sem cartão de crédito", "1 loja", "Até 3 fornecedores", "Até 50 produtos", "2 cotações por mês"],
    cta: "Começar grátis",
    note: null,
  },
  {
    name: "Pro",
    price: PLAN_PRICES.pro.display.replace("R$ ", ""),
    period: PLAN_PRICES.pro.note,
    highlight: true,
    badge: "MAIS POPULAR",
    oldPrice: null,
    features: [
      "Cotações ilimitadas",
      "Fornecedores ilimitados",
      "Até 500 produtos",
      "IA completa (análise + sugestões)",
      "Importação em massa (CSV/Excel)",
      "Histórico completo",
      "Suporte por WhatsApp",
    ],
    cta: "Começar 30 dias grátis",
    note: "🔒 Se não gerar economia, não faz sentido usar. Cancele quando quiser.",
  },
  {
    name: "Business",
    price: PLAN_PRICES.business.display.replace("R$ ", ""),
    period: PLAN_PRICES.business.note,
    highlight: false,
    badge: "PARA REDES",
    oldPrice: PLAN_PRICES.business.originalDisplay?.replace("R$ ", ""),
    features: [
      "Tudo do Pro",
      "Múltiplas lojas em rede",
      "Produtos ilimitados",
      "Conferência de notas fiscais",
      "Distribuição inteligente por IA",
      "Relatórios executivos",
      "Suporte prioritário",
    ],
    cta: "Começar 30 dias grátis",
    note: null,
  },
];

const faqItems = [
  { q: "Precisa instalar algum aplicativo?", a: "Não. Funciona direto no navegador do celular. Se quiser, pode salvar como app na tela inicial." },
  { q: "Os fornecedores precisam criar conta?", a: "Não. Eles recebem um link pelo WhatsApp e preenchem os preços sem instalar nada." },
  { q: "É difícil de usar?", a: "Não. Se você sabe usar WhatsApp, sabe usar o Compra360. Você aprende em minutos." },
  { q: "Funciona para meu tipo de negócio?", a: "Sim. Qualquer empresa que compra de fornecedores — supermercados, pet shops, farmácias, restaurantes, padarias e mais." },
  { q: "Isso realmente ajuda a economizar?", a: "Sim. Com os preços lado a lado você compra sempre do mais barato, sem esforço e sem achismo. Nossos usuários economizam em média 20% nas compras." },
  { q: "Meus dados ficam seguros?", a: "Sim. Suas cotações e preços são privados e criptografados. Nenhum fornecedor vê o preço do concorrente." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa. Cancele quando quiser com um clique." },
];

/* ── Demo Animado ── */
function DemoAnimado() {
  const section = useInView(0.3);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!section.visible) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % 12), 1200);
    return () => clearInterval(timer);
  }, [section.visible]);

  // Steps: 0-2 building list, 3 sending link, 4-7 prices arriving, 8-9 comparing, 10-11 order done
  const products = [
    { nome: "Arroz 5kg", show: step >= 0 },
    { nome: "Feijão 1kg", show: step >= 1 },
    { nome: "Óleo Soja 900ml", show: step >= 2 },
  ];

  const prices = [
    { forn: "Silva Dist.", arroz: "R$22,90", feijao: "R$8,50", oleo: "R$6,90", show: step >= 5 },
    { forn: "Atacado Pop.", arroz: "R$19,90", feijao: "R$7,80", oleo: "R$7,20", show: step >= 6, best: [true, true, false] },
    { forn: "Centro Norte", arroz: "R$21,50", feijao: "R$8,90", oleo: "R$5,90", show: step >= 7, best: [false, false, true] },
  ];

  const phase = step < 3 ? "list" : step < 5 ? "send" : step < 8 ? "prices" : step < 10 ? "compare" : "done";

  const phaseLabel = {
    list: "📝 Montando a lista de produtos...",
    send: "📤 Enviando link para fornecedores...",
    prices: "💰 Fornecedores preenchendo preços...",
    compare: "🔍 Comparando preços automaticamente...",
    done: "✅ Pedido fechado! Economia de R$47,00",
  }[phase];

  return (
    <section ref={section.ref} className="py-16 px-5 border-t border-white/5 bg-slate-900/30">
      <div className="max-w-4xl mx-auto">
        <p className={`text-teal-400 text-sm font-medium text-center mb-3 ${anim(section.visible)}`}>
          Veja na prática
        </p>
        <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-3 ${anim(section.visible)}`}>
          Uma cotação completa em segundos
        </h2>
        <p className={`text-slate-400 text-center mb-10 ${anim(section.visible)}`}>
          Acompanhe o fluxo real do sistema — tudo automatizado
        </p>

        {/* Progress bar */}
        <div className={`flex items-center gap-1 max-w-md mx-auto mb-8 ${anim(section.visible)}`} style={{ transitionDelay: "200ms" }}>
          {["list", "send", "prices", "compare", "done"].map((p, i) => (
            <div key={p} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  (phase === p) ? "bg-teal-400 w-full" :
                  (["list","send","prices","compare","done"].indexOf(phase) > i) ? "bg-teal-500/60 w-full" :
                  "bg-transparent w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Status label */}
        <div className={`text-center mb-6 ${anim(section.visible)}`} style={{ transitionDelay: "300ms" }}>
          <span className="inline-block bg-slate-800 border border-white/10 rounded-full px-4 py-1.5 text-sm text-slate-200 min-w-[280px] transition-all duration-500">
            {phaseLabel}
          </span>
        </div>

        {/* Animated mock UI */}
        <div className={`relative bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${anim(section.visible)}`} style={{ transitionDelay: "400ms" }}>
          {/* Mock header bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-slate-900/80">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[11px] text-slate-500 ml-2 font-mono">compra360.lovable.app/cotacao</span>
          </div>

          <div className="p-4 sm:p-6 min-h-[260px]">
            {/* Phase: List building */}
            {(phase === "list" || phase === "send") && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 mb-3 font-medium">PRODUTOS DA COTAÇÃO</p>
                {products.map((p, i) => (
                  <div
                    key={p.nome}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-all duration-500 ${
                      p.show ? "opacity-100 translate-x-0 bg-slate-900 border-white/10" : "opacity-0 -translate-x-4 border-transparent"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-300 ${p.show ? "border-teal-500 bg-teal-500/20" : "border-slate-700"}`}>
                      {p.show && <Check className="h-3 w-3 text-teal-300" />}
                    </div>
                    <span className="text-sm text-slate-300">{p.nome}</span>
                  </div>
                ))}
                {phase === "send" && (
                  <div className="mt-4 flex items-center gap-2 text-teal-400 text-sm animate-pulse">
                    <Send className="h-4 w-4" />
                    <span>Link enviado via WhatsApp para 3 fornecedores</span>
                  </div>
                )}
              </div>
            )}

            {/* Phase: Prices arriving + Compare + Done */}
            {(phase === "prices" || phase === "compare" || phase === "done") && (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs">
                        <th className="text-left py-2 font-medium">Produto</th>
                        {prices.map((p) => (
                          <th key={p.forn} className={`text-right py-2 font-medium transition-all duration-500 ${p.show ? "opacity-100" : "opacity-0"}`}>
                            {p.forn}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { nome: "Arroz 5kg", idx: 0, vals: prices.map(p => p.arroz) },
                        { nome: "Feijão 1kg", idx: 1, vals: prices.map(p => p.feijao) },
                        { nome: "Óleo Soja 900ml", idx: 2, vals: prices.map(p => p.oleo) },
                      ].map((prod) => (
                        <tr key={prod.nome} className="border-t border-white/5">
                          <td className="py-2.5 text-slate-300">{prod.nome}</td>
                          {prices.map((p, fi) => {
                            const isBest = phase !== "prices" && p.best?.[prod.idx];
                            return (
                              <td key={p.forn} className={`text-right py-2.5 font-mono transition-all duration-500 ${
                                !p.show ? "opacity-0" : isBest ? "text-teal-300 font-bold" : "text-slate-400"
                              }`}>
                                {p.show && (
                                  <span className={`inline-flex items-center gap-1 ${isBest ? "bg-teal-500/15 px-2 py-0.5 rounded" : ""}`}>
                                    {prod.vals[fi]}
                                    {isBest && <span className="text-[10px]">🏆</span>}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {phase === "done" && (
                  <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center animate-pulse">
                    <p className="text-emerald-400 font-bold text-sm">✅ Pedido gerado com os melhores preços!</p>
                    <p className="text-slate-500 text-xs mt-1">3 produtos · 2 fornecedores · Economia de <span className="text-emerald-400 font-semibold">R$47,00</span></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── component ── */
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const hero = useInView();
  const statsSection = useInView();
  const stepsSection = useInView();
  const benefitsSection = useInView();
  const socialSection = useInView();
  const plansSection = useInView();
  const faqSection = useInView();
  const ctaSection = useInView();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  if (user) return null;

  const goLogin = () => navigate("/login");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center">
            <img
              src="/compra360-logo.png"
              alt="Compra360 - Sistema de cotação"
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={goLogin}>
              Entrar
            </Button>
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white hover:scale-105 transition-all" onClick={goLogin}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={hero.ref} className="pt-20 pb-16 px-5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className={`text-teal-400 text-sm font-medium mb-6 ${anim(hero.visible)}`}>
              Sistema de cotação para supermercado e comércio
            </p>
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 ${anim(hero.visible)}`} style={{ transitionDelay: "100ms" }}>
              Pare de perder dinheiro com cotações lentas
              <span className="text-slate-500"> — comece a comprar melhor.</span>
            </h1>
            <p className={`text-lg text-slate-400 leading-relaxed mb-4 max-w-xl ${anim(hero.visible)}`} style={{ transitionDelay: "200ms" }}>
              O Compra360 reúne seus fornecedores em uma única tela. Compare preços em tempo real e feche o melhor pedido em minutos, direto do celular.
            </p>
            <ul className={`space-y-2.5 mb-8 ${anim(hero.visible)}`} style={{ transitionDelay: "250ms" }}>
              <li className="flex items-center gap-2 text-slate-300 text-sm sm:text-base"><CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> Compare preços de todos os fornecedores em segundos</li>
              <li className="flex items-center gap-2 text-slate-300 text-sm sm:text-base"><CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> Descubra automaticamente o fornecedor mais barato</li>
              <li className="flex items-center gap-2 text-slate-300 text-sm sm:text-base"><CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> Nunca mais pague caro sem perceber</li>
            </ul>
            <div className={`flex flex-col sm:flex-row gap-3 ${anim(hero.visible)}`} style={{ transitionDelay: "300ms" }}>
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-base px-8 h-12 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 transition-all duration-200"
                onClick={goLogin}
              >
                Começar grátis agora <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <p className="text-sm text-slate-500 self-center">30 dias grátis · Sem cartão</p>
            </div>
          </div>

          {/* Glass Card */}
          <div className={`relative ${anim(hero.visible)}`} style={{ transitionDelay: "400ms" }}>
            <div className="absolute -inset-6 bg-gradient-to-b from-emerald-500/10 to-teal-500/5 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-400 font-medium">Detergente Ypê 500ml — Caixa c/ 24un</p>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Cotação #47</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg">
                  <span className="text-sm text-slate-300">Distribuidora Silva</span>
                  <span className="text-sm text-slate-300 font-mono">R$ 54,90</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-teal-500/20 border border-teal-500/30">
                  <span className="text-sm text-white font-medium">Atacado Popular</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-teal-300 font-mono font-bold">R$ 43,90</span>
                    <span className="text-xs bg-teal-500/30 text-teal-200 px-1.5 py-0.5 rounded font-medium">🏆 Melhor</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg">
                  <span className="text-sm text-slate-300">Centro de Dist. Norte</span>
                  <span className="text-sm text-slate-300 font-mono">R$ 47,76</span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-slate-500 text-xs">Você pagaria</p>
                  <p className="text-slate-400 text-sm line-through">R$ 54,90</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500 text-xs">Com o Compra360</p>
                  <p className="text-teal-300 text-sm font-bold">R$ 43,90</p>
                </div>
              </div>
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                <p className="text-emerald-400 font-bold text-sm">💰 Economia: R$ 11,00/cx</p>
                <p className="text-slate-500 text-xs mt-0.5">× 10 caixas/mês = <span className="text-emerald-400 font-semibold">R$ 110,00 economizados</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsSection.ref} className="py-12 px-5 border-t border-white/5 bg-slate-900/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`text-center ${anim(statsSection.visible)}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <p className="text-3xl sm:text-4xl font-bold text-white">
                <AnimatedCounter target={s.value} suffix={s.suffix} visible={statsSection.visible} />
              </p>
              <p className="text-sm text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" ref={stepsSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className={`text-teal-400 text-sm font-medium text-center mb-3 ${anim(stepsSection.visible)}`}>Como funciona</p>
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-4 ${anim(stepsSection.visible)}`}>
            Economize em 3 passos simples
          </h2>
          <p className={`text-slate-400 text-center mb-12 max-w-lg mx-auto ${anim(stepsSection.visible)}`}>
            Sem planilha, sem ligação, sem complicação.
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className={`bg-slate-900 border border-white/5 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${anim(stepsSection.visible)}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-black text-teal-400">{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-teal-300" />
                  </div>
                </div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ANIMADO ── */}
      <DemoAnimado />

      {/* ── BENEFÍCIOS ── */}
      <section ref={benefitsSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className={`text-teal-400 text-sm font-medium text-center mb-3 ${anim(benefitsSection.visible)}`}>Por que escolher o Compra360</p>
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-4 ${anim(benefitsSection.visible)}`}>
            Tudo que você precisa para comprar melhor
          </h2>
          <p className={`text-slate-400 text-center mb-12 max-w-lg mx-auto ${anim(benefitsSection.visible)}`}>
            Funcionalidades pensadas para quem compra no dia a dia
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className={`group bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:bg-slate-900 hover:border-teal-500/20 transition-all duration-300 ${anim(benefitsSection.visible)}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:bg-teal-500/20 transition-colors">
                  <b.icon className="h-5 w-5 text-teal-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL ── */}
      <section ref={socialSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className={`text-teal-400 text-sm font-medium text-center mb-3 ${anim(socialSection.visible)}`}>Depoimentos</p>
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-12 ${anim(socialSection.visible)}`}>
            O que dizem quem já usa
          </h2>
          <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className={`bg-slate-900 border border-white/5 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${anim(socialSection.visible)}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, si) => (
                    <Star key={si} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${t.color}`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" ref={plansSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className={`text-teal-400 text-sm font-medium text-center mb-3 ${anim(plansSection.visible)}`}>Preços</p>
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-3 ${anim(plansSection.visible)}`}>
            Planos para todo tipo de negócio
          </h2>
          <p className={`text-slate-400 text-center mb-12 ${anim(plansSection.visible)}`} style={{ transitionDelay: "100ms" }}>
            Comece grátis. Pague só quando fizer sentido.
          </p>
          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`relative bg-slate-900 border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col ${
                  plan.highlight ? "border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.15)]" : plan.name === "Business" ? "border-white/20" : "border-white/5"
                } ${anim(plansSection.visible)}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-[0_0_12px_rgba(20,184,166,0.4)]">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-white font-bold text-lg mb-1">{plan.name === "Business" ? "👑 " : ""}{plan.name}</h3>
                <div className="mb-5">
                  {plan.oldPrice && (
                    <span className="text-slate-500 text-sm line-through mr-2">{plan.oldPrice}</span>
                  )}
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.note && (
                  <p className="text-sm text-teal-400 font-semibold mb-4">{plan.note}</p>
                )}
                <Button
                  className="w-full rounded-lg py-3 px-6 font-medium bg-emerald-500 hover:bg-emerald-400 text-white hover:scale-105 transition-all"
                  onClick={goLogin}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" ref={faqSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className={`max-w-2xl mx-auto ${anim(faqSection.visible)}`}>
          <p className="text-teal-400 text-sm font-medium text-center mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">
            Perguntas frequentes
          </h2>
          <p className="text-slate-400 text-center text-sm mb-10">Tudo que você precisa saber antes de começar</p>
          <Accordion type="single" collapsible defaultValue="faq-0" className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-white/10 rounded-none px-4 last:border-b-0">
                <AccordionTrigger className="text-base text-white font-medium hover:no-underline py-5 text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-400 leading-relaxed pb-5">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section ref={ctaSection.ref} className="py-16 px-5 border-t border-white/5">
        <div className={`max-w-2xl mx-auto text-center ${anim(ctaSection.visible)}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Comece a economizar hoje
          </h2>
          <p className="text-slate-400 mb-8">
            30 dias grátis · Sem cartão · Comece em menos de 2 minutos
          </p>
          <Button
            size="lg"
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-base px-8 h-12 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 transition-all duration-200"
            onClick={goLogin}
          >
            Começar a economizar agora <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <p className="text-sm text-slate-400 mt-4">
            Leva menos de 2 minutos para começar
          </p>
          <p className="text-teal-400 font-semibold text-sm mt-3">
            🔒 Risco zero — Teste grátis por 30 dias. Sem compromisso.
          </p>
          <p className="text-xs text-slate-500 mt-4">
            Já usado por compradores de supermercados, pet shops, farmácias e muito mais.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img
              src="/compra360-logo.png"
              alt="Compra360"
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <a href="#como-funciona" className="hover:text-slate-300 transition-colors">Como funciona</a>
            <span>·</span>
            <a href="#planos" className="hover:text-slate-300 transition-colors">Planos</a>
            <span>·</span>
            <a href="#faq" className="hover:text-slate-300 transition-colors">FAQ</a>
            <span>·</span>
            <button onClick={goLogin} className="hover:text-slate-300 transition-colors">Entrar</button>
          </div>
          <p className="text-xs text-slate-600">© 2026 Compra360 · Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
}
