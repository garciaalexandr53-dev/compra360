import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, FileText, Network, TrendingUp, ShieldCheck } from "lucide-react";

const PDF_URL = "/compra360-white-paper.pdf";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(200),
  whatsapp: z.string().trim().max(30).optional(),
  empresa: z.string().trim().max(160).optional(),
  perfil: z.enum(["investidor", "supermercado", "fornecedor", "outro"]),
});

const PERFIS = [
  { v: "investidor", l: "Investidor" },
  { v: "supermercado", l: "Supermercado" },
  { v: "fornecedor", l: "Fornecedor" },
  { v: "outro", l: "Outro" },
] as const;

const TOPICOS = [
  { icon: FileText, t: "Tese e problema", d: "Por que a compra do supermercado regional ainda é manual." },
  { icon: Network, t: "Efeito de rede", d: "Como a Rede de Fornecedores cresce a cada novo supermercado." },
  { icon: TrendingUp, t: "Tração real", d: "Números de uso extraídos da base, sem projeções infladas." },
  { icon: ShieldCheck, t: "Governança", d: "Sigilo comercial, consentimento e LGPD." },
];

export default function WhitePaperPage() {
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "", empresa: "", perfil: "investidor" });
  const [loading, setLoading] = useState(false);
  const [liberado, setLiberado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({
      ...form,
      whatsapp: form.whatsapp || undefined,
      empresa: form.empresa || undefined,
    });
    if (!r.success) {
      toast({ title: r.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("leads_whitepaper" as never).insert({
      nome: r.data.nome,
      email: r.data.email,
      whatsapp: r.data.whatsapp ?? null,
      empresa: r.data.empresa ?? null,
      perfil: r.data.perfil,
    } as never);
    setLoading(false);
    if (error) {
      // Nunca travar o download por falha no registro
      console.error(error);
    }
    setLiberado(true);
    window.open(PDF_URL, "_blank", "noopener");
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="White Paper Compra360 — digitalizando a compra do supermercado"
        description="Tese, produto, tração real e o efeito de rede de fornecedores do Compra360. Baixe o documento para investidores e parceiros."
        path="/whitepaper"
      />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-primary">Compra360</Link>
          <span className="text-xs text-muted-foreground">White Paper · 2026</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2 md:py-14">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Para investidores e parceiros</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Digitalizando a compra do supermercado regional
          </h1>
          <p className="mt-3 text-muted-foreground">
            Um documento de 7 páginas sobre como o Compra360 conecta comprador, fornecedor e equipe da loja — e por que a Rede de Fornecedores torna o modelo defensável.
          </p>
          <ul className="mt-6 space-y-4">
            {TOPICOS.map(({ icon: I, t, d }) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <I className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t}</p>
                  <p className="text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
          {liberado ? (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold text-foreground">Obrigado!</h2>
              <p className="text-sm text-muted-foreground">O download foi aberto em uma nova aba. Se não abriu, use o botão abaixo.</p>
              <Button asChild className="w-full">
                <a href={PDF_URL} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Baixar White Paper</a>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href="https://wa.me/5544984483553?text=Ol%C3%A1!%20Li%20o%20White%20Paper%20do%20Compra360%20e%20gostaria%20de%20conversar." target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>
              </Button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">Receba o documento</h2>
              <div className="space-y-1.5">
                <Label htmlFor="wp-nome">Nome *</Label>
                <Input id="wp-nome" value={form.nome} onChange={set("nome")} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wp-email">E-mail *</Label>
                <Input id="wp-email" type="email" value={form.email} onChange={set("email")} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wp-whats">WhatsApp</Label>
                <Input id="wp-whats" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wp-emp">Empresa</Label>
                <Input id="wp-emp" value={form.empresa} onChange={set("empresa")} maxLength={160} />
              </div>
              <div className="space-y-1.5">
                <Label>Você é</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PERFIS.map((p) => (
                    <Button
                      key={p.v}
                      type="button"
                      variant={form.perfil === p.v ? "default" : "outline"}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, perfil: p.v }))}
                    >
                      {p.l}
                    </Button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                {loading ? "Enviando..." : "Baixar White Paper"}
              </Button>
              <p className="text-xs text-muted-foreground">Usamos seus dados só para falar sobre o Compra360. Nada de spam.</p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
