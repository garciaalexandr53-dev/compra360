import {
  Scale, PiggyBank, Clock, BarChart3, PieChart, Trophy, Check, type LucideIcon,
} from "lucide-react";
import type { Slide, SlideTone, PhoneMock } from "./slidesData";
import { withAssetVersion } from "@/lib/assetVersion";

const icons: Record<string, LucideIcon> = {
  Scale, PiggyBank, Clock, BarChart3, PieChart, Trophy,
};

const toneText: Record<SlideTone, string> = {
  ok: "text-primary",
  warn: "text-[hsl(30_95%_45%)]",
  bad: "text-destructive",
  muted: "text-muted-foreground",
};

function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <img
        src={withAssetVersion("/compra360-icon.png")}
        alt="Compra360"
        width={56}
        height={56}
        className="h-14 w-14 rounded-xl"
      />
      <span className={`slide-subtitle font-bold ${dark ? "text-primary-foreground" : "text-foreground"}`}>
        Compra360
      </span>
    </div>
  );
}

function Phone({ mock }: { mock: PhoneMock }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-[420px] rounded-[48px] border-[10px] border-foreground/15 bg-card p-6 shadow-lg">
        <div className="mx-auto mb-6 h-2 w-24 rounded-full bg-foreground/20" />
        <div className="slide-caption mb-5 font-bold uppercase tracking-widest text-primary">
          {mock.header}
        </div>
        <div className="flex flex-col gap-4">
          {mock.rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-5 py-4"
            >
              <span className={`slide-caption font-medium ${row.tone ? toneText[row.tone] : "text-foreground"}`}>
                {row.label}
              </span>
              {row.value && (
                <span className="slide-caption font-mono font-bold text-foreground">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="slide-caption max-w-[420px] text-center text-muted-foreground">{mock.caption}</p>
    </div>
  );
}

function Matrix() {
  const cols = ["Fornecedor A", "Fornecedor B", "Fornecedor C"];
  const rows: { name: string; values: (string | null)[]; best: number }[] = [
    { name: "Arroz Tipo 1 5kg", values: ["24,90", "25,80", "26,40"], best: 0 },
    { name: "Óleo de Soja 900ml", values: ["6,40", "6,20", null], best: 1 },
    { name: "Açúcar Refinado 1kg", values: ["4,10", "4,35", "3,98"], best: 2 },
    { name: "Feijão Carioca 1kg", values: ["8,70", "8,45", "8,90"], best: 1 },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-border bg-card">
      <div className="grid grid-cols-[560px_repeat(3,1fr)] bg-primary text-primary-foreground">
        <div className="slide-caption px-8 py-6 font-bold">Produto</div>
        {cols.map((c) => (
          <div key={c} className="slide-caption px-8 py-6 text-center font-bold">{c}</div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.name}
          className={`grid grid-cols-[560px_repeat(3,1fr)] ${ri % 2 ? "bg-muted/50" : ""}`}
        >
          <div className="slide-body px-8 py-6 font-medium text-foreground">{r.name}</div>
          {r.values.map((v, ci) => (
            <div key={ci} className="px-8 py-6 text-center">
              {v === null ? (
                <span className="slide-caption text-muted-foreground">sem preço</span>
              ) : (
                <span
                  className={`slide-body font-mono font-bold ${
                    ci === r.best ? "text-primary" : "text-foreground"
                  }`}
                >
                  R$ {v}
                  {ci === r.best && <span className="slide-badge ml-3 text-primary">MIN</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SlideRenderer({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  const isDark = slide.variant === "cover" || slide.variant === "closing" || slide.variant === "section";

  if (isDark) {
    return (
      <div className="slide-content flex flex-col justify-between bg-primary px-[140px] py-[90px] text-primary-foreground">
        <Logo dark />
        <div className="max-w-[1400px]">
          {slide.kicker && <p className="slide-kicker mb-8 text-primary-foreground/70">{slide.kicker}</p>}
          <h1 className="slide-title-lg font-bold">{slide.title}</h1>
          {slide.subtitle && (
            <p className="slide-subtitle mt-10 max-w-[1200px] text-primary-foreground/85">{slide.subtitle}</p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="slide-footer text-primary-foreground/70">{slide.note ?? ""}</span>
          <span className="slide-page rounded-full bg-primary-foreground/15 px-5 py-2">
            {index + 1}/{total}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="slide-content flex flex-col bg-background px-[120px] py-[70px]">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="slide-page rounded-full bg-accent px-5 py-2 text-accent-foreground">
          {index + 1}/{total}
        </span>
      </div>

      <div className="mt-10 flex-1">
        {slide.kicker && <p className="slide-kicker mb-5 text-primary">{slide.kicker}</p>}
        <h2 className="slide-title font-bold text-foreground">{slide.title}</h2>

        {slide.paragraphs?.map((p) => (
          <p key={p} className="slide-body-lg mt-8 max-w-[1050px] text-muted-foreground">{p}</p>
        ))}

        {slide.bullets && (
          <div className="mt-12 grid grid-cols-2 gap-8">
            {slide.bullets.map((b) => (
              <div
                key={b.title}
                className="rounded-3xl border-l-8 border-primary bg-card px-10 py-8 shadow-sm"
              >
                <div className="flex items-start gap-5">
                  <Check className={`mt-2 h-10 w-10 shrink-0 ${b.tone ? toneText[b.tone] : "text-primary"}`} />
                  <div>
                    <p className="slide-body-lg font-bold text-foreground">{b.title}</p>
                    {b.text && <p className="slide-body mt-3 text-muted-foreground">{b.text}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.cards && (
          <div className="mt-14 grid grid-cols-3 gap-10">
            {slide.cards.map((c) => {
              const Icon = icons[c.icon] ?? Check;
              return (
                <div
                  key={c.title}
                  className="flex min-h-[380px] flex-col rounded-3xl bg-card px-10 py-10 shadow-sm ring-1 ring-border"
                >
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-accent">
                    <Icon className="h-12 w-12 text-primary" />
                  </div>
                  <p className="slide-subtitle font-bold text-foreground">{c.title}</p>
                  <p className="slide-body mt-5 text-muted-foreground">{c.text}</p>
                </div>
              );
            })}
          </div>
        )}

        {slide.steps && (
          <div className="mt-16 grid grid-cols-4 gap-8">
            {slide.steps.map((s) => (
              <div key={s.n} className="rounded-3xl bg-card px-8 py-9 shadow-sm ring-1 ring-border">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
                  <span className="slide-subtitle font-bold text-primary-foreground">{s.n}</span>
                </div>
                <p className="slide-body-lg font-bold text-foreground">{s.title}</p>
                <p className="slide-body mt-4 text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        )}

        {slide.stats && (
          <div className="mt-16 grid grid-cols-3 gap-10">
            {slide.stats.map((s) => (
              <div
                key={s.label}
                className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl bg-accent px-8 py-10 text-center"
              >
                <p className="slide-title font-bold text-primary">{s.value}</p>
                <p className="slide-body mt-5 text-accent-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {slide.phones && (
          <div className="mt-12 grid grid-cols-3 gap-12">
            {slide.phones.map((m) => (
              <Phone key={m.header} mock={m} />
            ))}
          </div>
        )}

        {slide.matrix && <div className="mt-12">{<Matrix />}</div>}

        {slide.plans && (
          <div className="mt-14 grid grid-cols-3 gap-10">
            {slide.plans.map((p) => (
              <div
                key={p.name}
                className="flex min-h-[380px] flex-col rounded-3xl bg-card px-10 py-10 shadow-sm ring-1 ring-border"
              >
                <p className="slide-subtitle font-bold text-primary">{p.name}</p>
                <div className="mt-8 flex flex-col gap-5">
                  {p.items.map((it) => (
                    <div key={it} className="flex items-start gap-4">
                      <Check className="mt-1 h-8 w-8 shrink-0 text-primary" />
                      <span className="slide-body text-foreground">{it}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.quote && (
          <div className="mt-12 rounded-3xl border-l-8 border-primary bg-card px-12 py-10">
            <p className="slide-body-lg italic text-foreground">“{slide.quote.text}”</p>
            <p className="slide-caption mt-5 text-muted-foreground">— {slide.quote.author}</p>
          </div>
        )}
      </div>

      {slide.note && <p className="slide-footer mt-8 text-muted-foreground">{slide.note}</p>}
    </div>
  );
}
