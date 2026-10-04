import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, Copy, MessageCircle, Loader2, RotateCcw } from "lucide-react";
import {
  PRESETS_PROPOSTA, PROPOSTA_PADRAO, PropostaDados, economiaAnual, horasEconomizadasMes,
  mensagemWhatsApp, brl, dataBR, dataValidade,
} from "@/lib/propostaComercial";
import { baixarPropostaPdf } from "@/lib/propostaComercialPdf";

const KEY = "admin-proposta-comercial";

export default function PropostaComercialTab() {
  const [d, setD] = useState<PropostaDados>(() => {
    try { return { ...PROPOSTA_PADRAO, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return PROPOSTA_PADRAO; }
  });
  const [gerando, setGerando] = useState(false);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);

  const set = <K extends keyof PropostaDados>(k: K, v: PropostaDados[K]) => setD((p) => ({ ...p, [k]: v }));
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);

  const eco = economiaAnual(d);
  const horas = horasEconomizadasMes(d);
  const msg = useMemo(() => mensagemWhatsApp(d), [d]);

  const aplicarPreset = (id: string) => {
    const p = PRESETS_PROPOSTA.find((x) => x.id === id);
    if (p) setD((s) => ({ ...s, presetId: id, anual: p.anual, mensal: p.mensal, implantacao: p.implantacao }));
  };

  const baixar = async () => {
    setGerando(true);
    try { await baixarPropostaPdf(d); }
    catch { toast({ title: "Não foi possível gerar o PDF", variant: "destructive" }); }
    finally { setGerando(false); }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast({ title: "Mensagem copiada" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };

  const fone = d.whatsDecisor.replace(/\D/g, "");
  const abrirWhats = () => {
    const n = fone.startsWith("55") ? fone : `55${fone}`;
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <F label="Supermercado / Rede"><Input value={d.rede} onChange={(e) => set("rede", e.target.value)} placeholder="Ex: Supermercado Bom Preço" /></F>
            <F label="Nome do decisor"><Input value={d.decisor} onChange={(e) => set("decisor", e.target.value)} placeholder="Ex: Roberto Alencar" /></F>
            <F label="Cidade / UF"><Input value={d.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Ex: Cianorte / PR" /></F>
            <F label="WhatsApp do decisor"><Input inputMode="tel" value={d.whatsDecisor} onChange={(e) => set("whatsDecisor", e.target.value)} placeholder="Ex: 44 99999-0000" /></F>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Operação</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <F label="Lojas"><Input type="number" min={1} max={10} value={d.lojas} onChange={(e) => set("lojas", Math.min(10, Math.max(1, num(e.target.value))))} /></F>
            <F label="Itens/cotação"><Input type="number" min={1} value={d.itensPorCotacao} onChange={(e) => set("itensPorCotacao", num(e.target.value))} /></F>
            <F label="Cotações/semana"><Input type="number" min={0} value={d.cotacoesPorSemana} onChange={(e) => set("cotacoesPorSemana", num(e.target.value))} /></F>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Preço</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESETS_PROPOSTA.map((p) => (
                <Button key={p.id} size="sm" variant={d.presetId === p.id ? "default" : "outline"} onClick={() => aplicarPreset(p.id)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="Anual à vista (R$)"><Input type="number" value={d.anual} onChange={(e) => setD((s) => ({ ...s, anual: num(e.target.value), presetId: "custom" }))} /></F>
              <F label="Mensal (R$)"><Input type="number" value={d.mensal} onChange={(e) => setD((s) => ({ ...s, mensal: num(e.target.value), presetId: "custom" }))} /></F>
              <F label="Implantação (R$)"><Input type="number" value={d.implantacao} onChange={(e) => setD((s) => ({ ...s, implantacao: num(e.target.value), presetId: "custom" }))} /></F>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Fechamento</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <F label="Validade (dias)"><Input type="number" min={1} value={d.validadeDias} onChange={(e) => set("validadeDias", Math.max(1, num(e.target.value)))} /></F>
            <F label="Chave Pix"><Input value={d.pix} onChange={(e) => set("pix", e.target.value)} placeholder="CNPJ, e-mail ou celular" /></F>
            <F label="WhatsApp de contato"><Input value={d.contato} onChange={(e) => set("contato", e.target.value)} /></F>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 self-start">
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-xs text-muted-foreground">Preparado para</div>
              <div className="font-semibold truncate">{d.rede || "Supermercado"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[d.decisor, d.cidade, `${d.lojas} ${d.lojas === 1 ? "loja" : "lojas"}`].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <Badge className="mb-1 text-[10px]">Recomendado</Badge>
              <div className="text-xs text-muted-foreground">Anual à vista</div>
              <div className="text-xl font-bold text-primary">{brl(d.anual)}</div>
              <div className="text-xs text-muted-foreground">ou 12x de {brl(d.anual / 12)} · implantação grátis</div>
              {eco > 0 && <div className="text-xs font-medium text-primary mt-1">Economia de {brl(eco)} no 1º ano</div>}
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Mensal</div>
              <div className="text-lg font-semibold">{brl(d.mensal)}/mês</div>
              {d.implantacao > 0 && <div className="text-xs text-muted-foreground">+ {brl(d.implantacao)} de implantação</div>}
            </div>
            <div className="text-xs text-muted-foreground">
              ~{horas} h economizadas/mês · válida até {dataBR(dataValidade(new Date(), d.validadeDias))}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={baixar} disabled={gerando}>
          {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Baixar PDF
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copiar}><Copy className="h-4 w-4 mr-2" />Copiar mensagem</Button>
          <Button variant="outline" onClick={abrirWhats} disabled={fone.length < 10}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</Button>
        </div>
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setD(PROPOSTA_PADRAO)}>
          <RotateCcw className="h-3 w-3 mr-1" />Nova proposta (limpar)
        </Button>
      </div>
    </div>
  );
}
