import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Grid3X3, Play, Printer, Moon, Sun, X,
} from "lucide-react";
import ScaledSlide from "@/components/slides/ScaledSlide";
import SlideRenderer from "@/components/slides/SlideRenderer";
import { slides } from "@/components/slides/slidesData";
import { useTheme } from "@/hooks/useTheme";

export default function ApresentacaoPage() {
  const [params, setParams] = useSearchParams();
  const { theme, toggle } = useTheme();
  const isPrint = params.has("print");
  const total = slides.length;

  const index = useMemo(() => {
    const raw = Number(params.get("slide") ?? 1);
    if (!Number.isFinite(raw)) return 0;
    return Math.min(Math.max(Math.round(raw) - 1, 0), total - 1);
  }, [params, total]);

  const [grid, setGrid] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), total - 1);
      const p = new URLSearchParams(params);
      p.set("slide", String(clamped + 1));
      setParams(p, { replace: true });
    },
    [params, setParams, total],
  );

  useEffect(() => {
    document.title = `${index + 1}/${total} — ${slides[index].title} · Compra360`;
  }, [index, total]);

  useEffect(() => {
    if (isPrint) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key.toLowerCase() === "g") {
        setGrid((g) => !g);
      } else if (e.key === "Escape") {
        setGrid(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, isPrint]);

  useEffect(() => {
    const onFsChange = () => setPresenting(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const present = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setPresenting(true);
    }
  };

  const exitPresent = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    setPresenting(false);
  };

  if (isPrint) {
    return (
      <main className="bg-background">
        <h1 className="sr-only">Apresentação Compra360</h1>
        {slides.map((s, i) => (
          <div key={s.id} className="slide-print-page h-[56.25vw] w-full">
            <ScaledSlide>
              <SlideRenderer slide={s} index={i} total={total} />
            </ScaledSlide>
          </div>
        ))}
      </main>
    );
  }

  if (presenting) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <ScaledSlide>
          <SlideRenderer slide={slides[index]} index={index} total={total} />
        </ScaledSlide>
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 opacity-40 transition hover:opacity-100">
          <Button size="icon" variant="secondary" onClick={() => goTo(index - 1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={() => goTo(index + 1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={exitPresent} aria-label="Sair da apresentação">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2 md:px-5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-primary">Compra360</span>
          <span className="text-xs text-muted-foreground">
            Apresentação · {index + 1}/{total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setGrid((g) => !g)} aria-label="Visão em grade">
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggle} aria-label="Alternar tema">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" asChild aria-label="Exportar PDF">
            <a href="/apresentacao?print" target="_blank" rel="noreferrer">
              <Printer className="h-4 w-4" />
            </a>
          </Button>
          <Button size="sm" onClick={present}>
            <Play className="mr-2 h-4 w-4" />
            Apresentar
          </Button>
        </div>
      </header>

      {grid ? (
        <main className="grid flex-1 grid-cols-1 gap-3 overflow-auto p-3 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                goTo(i);
                setGrid(false);
              }}
              className={`overflow-hidden rounded-lg border-2 bg-card text-left transition ${
                i === index ? "border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="aspect-video w-full">
                <ScaledSlide>
                  <SlideRenderer slide={s} index={i} total={total} />
                </ScaledSlide>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-xs font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              </div>
            </button>
          ))}
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-2 md:p-6">
          <div className="aspect-video w-full max-w-[1400px] overflow-hidden rounded-xl bg-card shadow-lg">
            <ScaledSlide>
              <SlideRenderer slide={slides[index]} index={index} total={total} />
            </ScaledSlide>
          </div>
          <div className="flex items-center gap-3">
            <Button size="icon" variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Slide anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {index + 1} / {total}
            </span>
            <Button size="icon" variant="outline" onClick={() => goTo(index + 1)} disabled={index === total - 1} aria-label="Próximo slide">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
