import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
  MessageCircle,
  ChevronRight,
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

/* ── data ── */
const steps = [
  { icon: Send, title: "Monte e Envie", desc: "Crie sua lista e mande o link via WhatsApp" },
  { icon: Zap, title: "Receba os Preços", desc: "Os fornecedores preenchem sem precisar de conta ou app" },
  { icon: Trophy, title: "Compre Melhor", desc: "O sistema destaca a melhor oferta para você fechar o pedido" },
];

const chatFaq = [
  { q: "Meus fornecedores vão aceitar?", a: "Sim. Representantes da região já usam e aprovam a praticidade." },
  { q: "É difícil de usar?", a: "Não. Você aprende em minutos e funciona direto no navegador do celular." },
  { q: "Como evita erros?", a: "Cada produto tem descrição exata. O fornecedor vê o item correto e você recebe exatamente o preço que pediu." },
];

const testimonials = [
  {
    text: "Pelo celular é muito rápido. É o sistema mais prático que já vi. Para o vendedor mais antigo, é uma mão na roda.",
    name: "Bruno",
    role: "Representante Comercial",
    company: "Destrinho",
  },
  {
    text: "Mais prático que planilha de Excel. O sistema é rápido e ajuda a não ter erro no pedido.",
    name: "Marquinhos",
    role: "Representante Comercial",
    company: "Fornecedor Campeão",
  },
];

const plans = [
  {
    name: "Gratuito",
    price: "R$0",
    period: "/mês",
    highlight: false,
    badge: null,
    features: ["Sem cartão de crédito", "1 loja", "Até 3 fornecedores", "2 cotações por mês"],
    cta: "Começar grátis",
    ctaVariant: "outline" as const,
    note: null,
  },
  {
    name: "Pro",
    price: "R$97",
    period: "/mês",
    highlight: true,
    badge: "MAIS POPULAR",
    features: [
      "Cotações ilimitadas",
      "Fornecedores ilimitados",
      "IA completa (análise + sugestões)",
      "Histórico completo",
      "Suporte por WhatsApp",
    ],
    cta: "Começar 30 dias grátis",
    ctaVariant: "default" as const,
    note: "Se não gerar economia, não faz sentido usar.",
  },
  {
    name: "Business",
    price: "R$197",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "Tudo do Pro",
      "Múltiplas lojas em rede",
      "Relatórios executivos",
      "Suporte prioritário",
    ],
    cta: "Falar com especialista",
    ctaVariant: "outline" as const,
    note: null,
  },
];

const faqItems = [
  { q: "O fornecedor precisa criar conta?", a: "Não. Ele apenas abre o link e preenche os valores. Sem instalar nada." },
  { q: "Funciona em qualquer celular?", a: "Sim. O sistema é 100% focado em mobilidade." },
  { q: "Vou precisar mudar meu jeito de trabalhar?", a: "Não. Só fica mais rápido e organizado." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, multas ou burocracia." },
  { q: "Meus dados estão seguros?", a: "Sim. Suas cotações e preços são privados e criptografados." },
  { q: "Funciona para meu tipo de negócio?", a: "Sim. Qualquer empresa que compra de fornecedores — supermercados, pet shops, farmácias, restaurantes e mais." },
];

/* ── component ── */
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const hero = useInView();
  const stepsSection = useInView();
  const chatSection = useInView();
  const socialSection = useInView();
  const plansSection = useInView();
  const faqSection = useInView();
  const ctaSection = useInView();

  const [openChat, setOpenChat] = useState<number | null>(null);

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
          <div className="flex items-center gap-2">
            <img src="/compra360-icon.png" alt="Compra360" width="28" height="28" className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-white text-lg">Compra360</span>
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
      <section ref={hero.ref} className="pt-20 pb-10 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className={`text-teal-400 text-sm font-medium mb-6 ${anim(hero.visible)}`}>
              Usado por compradores de supermercados, pet shops, farmácias e muito mais
            </p>
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 ${anim(hero.visible)}`} style={{ transitionDelay: "100ms" }}>
              Você está perdendo tempo e dinheiro todos os dias com cotações lentas
              <span className="text-slate-500"> — e nem percebe.</span>
            </h1>
            <p className={`text-lg text-slate-400 leading-relaxed mb-8 max-w-2xl ${anim(hero.visible)}`} style={{ transitionDelay: "200ms" }}>
              O Compra360 reúne seus fornecedores em uma única tela. Compare preços em tempo real e feche o melhor pedido em minutos, direto do celular.
            </p>
            <Button
              size="lg"
              className={`bg-emerald-500 hover:bg-emerald-400 text-white text-base px-8 h-12 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 transition-all duration-200 ${anim(hero.visible)}`}
              style={{ transitionDelay: "300ms" }}
              onClick={goLogin}
            >
              Começar a economizar agora <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Glass Card */}
          <div className={`mt-12 max-w-sm relative ${anim(hero.visible)}`} style={{ transitionDelay: "400ms" }}>
            <div className="absolute -inset-4 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-3xl blur-xl pointer-events-none" />
            <div className="relative bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-slate-400 font-medium mb-3">Detergente Ypê 500ml</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg">
                  <span className="text-sm text-slate-300">Fornecedor A</span>
                  <span className="text-sm text-slate-300 font-mono">R$ 24,50</span>
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-teal-500/20 border border-teal-500/30">
                  <span className="text-sm text-white font-medium">Fornecedor B</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-teal-300 font-mono font-bold">R$ 19,90</span>
                    <span className="text-xs bg-teal-500/30 text-teal-200 px-1.5 py-0.5 rounded font-medium">🏆 Melhor</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg">
                  <span className="text-sm text-slate-300">Fornecedor C</span>
                  <span className="text-sm text-slate-300 font-mono">R$ 22,30</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 text-center">
                <p className="text-emerald-400 font-bold text-sm">💰 Economia: R$ 4,60</p>
                <p className="text-slate-500 text-xs mt-0.5">em apenas 1 produto</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 PASSOS ── */}
      <section ref={stepsSection.ref} className="py-24 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-12 ${anim(stepsSection.visible)}`}>
            Economize em 3 passos simples
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className={`bg-slate-900 border border-white/5 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${anim(stepsSection.visible)}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4">
                  <s.icon className="h-5 w-5 text-teal-400" />
                </div>
                <h3 className="font-bold text-white mb-1.5">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHAT CONCIERGE ── */}
      <section ref={chatSection.ref} className="py-24 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-3 ${anim(chatSection.visible)}`}>
            Tire suas dúvidas antes de começar
          </h2>
          <p className={`text-slate-400 text-center mb-10 ${anim(chatSection.visible)}`} style={{ transitionDelay: "100ms" }}>
            Clique em uma pergunta
          </p>
          <div className={`bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-2 ${anim(chatSection.visible)}`} style={{ transitionDelay: "200ms" }}>
            {chatFaq.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenChat(openChat === i ? null : i)}
                  className="flex items-center gap-3 text-left w-full group py-4 px-5 border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 text-teal-400 shrink-0" />
                  <span className="text-base text-teal-300 font-medium group-hover:text-teal-200 transition-colors">
                    {item.q}
                  </span>
                  <ArrowRight className={`h-4 w-4 text-slate-500 ml-auto shrink-0 transition-transform ${openChat === i ? "rotate-90" : ""}`} />
                </button>
                {openChat === i && (
                  <div className="ml-6 mt-2 bg-slate-800/50 rounded-xl px-4 py-3 text-sm text-slate-300 leading-relaxed animate-fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL ── */}
      <section ref={socialSection.ref} className="py-24 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-bold text-white text-center mb-12 ${anim(socialSection.visible)}`}>
            O que dizem quem já usa
          </h2>
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${i === 0 ? "bg-teal-500" : "bg-emerald-500"}`}>
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
      <section ref={plansSection.ref} className="py-24 px-5 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
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
                  <p className="text-xs text-slate-500 italic mb-4">{plan.note}</p>
                )}
                <Button
                  variant={plan.ctaVariant}
                  className={`w-full rounded-xl ${
                    plan.highlight
                      ? "bg-emerald-500 hover:bg-emerald-400 text-white hover:scale-105 transition-all"
                      : "border-white/10 text-slate-300 hover:bg-white/5"
                  }`}
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
      <section ref={faqSection.ref} className="py-24 px-5 border-t border-white/5">
        <div className={`max-w-2xl mx-auto ${anim(faqSection.visible)}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">
            Perguntas frequentes
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-white/5 border-b border-b-white/10 rounded-xl px-5 bg-slate-900">
                <AccordionTrigger className="text-base text-slate-200 font-medium hover:no-underline py-5">
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
      <section ref={ctaSection.ref} className="py-24 px-5 border-t border-white/5">
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
          <div className="flex items-center gap-2">
            <img src="/compra360-icon.png" alt="Compra360" width="24" height="24" className="w-6 h-6 rounded-md" />
            <span className="font-semibold text-white text-sm">Compra360</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <button onClick={goLogin} className="hover:text-slate-300 transition-colors">Entrar</button>
            <span>·</span>
            <button onClick={goLogin} className="hover:text-slate-300 transition-colors">Criar conta</button>
            <span>·</span>
            <span>Contato</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 Compra360 · Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
}
