import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Package,
  Users,
  BarChart3,
  Link2,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Zap,
  Shield,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Banco de Produtos",
    desc: "Cadastre e organize todos os produtos que sua empresa compra. Importe em massa via CSV ou Excel.",
  },
  {
    icon: Users,
    title: "Fornecedores",
    desc: "Gerencie seus fornecedores com dados completos e links únicos para preenchimento de preços.",
  },
  {
    icon: Link2,
    title: "Links de Cotação",
    desc: "Envie links por WhatsApp para fornecedores preencherem preços de forma simples e rápida.",
  },
  {
    icon: BarChart3,
    title: "Comparação Automática",
    desc: "Matriz de preços com destaques visuais: menor preço, segundo menor e alertas de sobrepreço.",
  },
  {
    icon: ShoppingCart,
    title: "Pedidos Otimizados",
    desc: "Gere pedidos automaticamente com os melhores preços e envie direto pelo WhatsApp.",
  },
  {
    icon: TrendingUp,
    title: "Análise & Histórico",
    desc: "Acompanhe a evolução de preços, compare cotações e tome decisões baseadas em dados.",
  },
];

const benefits = [
  { icon: Zap, text: "Reduza custos de compras em até 30%" },
  { icon: Clock, text: "Economize horas no processo de cotação" },
  { icon: Shield, text: "Padronize e controle todas as compras" },
  { icon: CheckCircle, text: "Decisões baseadas em dados reais" },
];

const steps = [
  { n: "1", title: "Prepare", desc: "Cadastre produtos e fornecedores" },
  { n: "2", title: "Cote", desc: "Envie links e receba preços" },
  { n: "3", title: "Analise", desc: "Compare e escolha os melhores" },
  { n: "4", title: "Peça", desc: "Gere e envie pedidos otimizados" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/20" />
        <div className="relative max-w-5xl mx-auto px-5 pt-16 pb-20 text-center">
          <img src="/logo-compra360.png" alt="Compra360" className="w-16 h-16 rounded-2xl shadow-lg mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-4">
            Cotações inteligentes,
            <br />
            <span className="text-primary">compras mais baratas.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            O Compra360 automatiza o processo de cotação de preços: envie links para fornecedores,
            compare preços em tempo real e gere pedidos otimizados com um clique.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/login")}>
              Começar agora <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => {
              document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
            }}>
              Como funciona
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits bar */}
      <section className="border-y bg-card">
        <div className="max-w-5xl mx-auto px-5 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {benefits.map((b) => (
            <div key={b.text} className="flex items-start gap-2.5">
              <b.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm font-medium text-foreground">{b.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">
          Como funciona?
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center mx-auto mb-3 shadow-md">
                {s.n}
              </div>
              <h3 className="font-bold text-foreground mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {i < 3 && (
                <ArrowRight className="hidden sm:block absolute top-5 -right-2 h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-5xl mx-auto px-5">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            Tudo que você precisa para cotar melhor
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <f.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-bold text-foreground mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-5 py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Pronto para economizar nas compras?
        </h2>
        <p className="text-muted-foreground mb-6">
          Crie sua conta gratuita e comece a cotar em minutos.
        </p>
        <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/login")}>
          Criar conta grátis <ArrowRight className="h-4 w-4" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Compra360 — Cotações inteligentes para seu negócio.
      </footer>
    </div>
  );
}
