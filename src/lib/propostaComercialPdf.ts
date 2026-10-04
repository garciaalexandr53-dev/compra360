import jsPDF from "jspdf";
import { withAssetVersion } from "@/lib/assetVersion";
import {
  PropostaDados, economiaAnual, horasEconomizadasMes, tempoCotacaoMin,
  dataValidade, numeroProposta, brl, dataBR,
} from "@/lib/propostaComercial";

const LOGO_URL = withAssetVersion("https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada//logo-completa.png");

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const NAVY: [number, number, number] = [40, 50, 75];
const GREEN: [number, number, number] = [22, 135, 85];
const GRAY: [number, number, number] = [100, 106, 120];

const INCLUSOS = [
  "Cotação centralizada para todas as lojas da rede",
  "Equalização inteligente de preços e regras de pedido mínimo",
  "Envio sequencial de listas e pedidos prontos via WhatsApp",
  "Importação de planilhas do ERP com memória de formato",
  "Conferência física das entregas no recebimento",
  "Implantação, treinamento da equipe e suporte direto via WhatsApp",
];

export function buildPropostaPdf(d: PropostaDados, logo: string | null, hoje = new Date()): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  const validade = dataValidade(hoje, d.validadeDias);
  const eco = economiaAnual(d);
  const horas = horasEconomizadasMes(d);
  const { antes, depois } = tempoCotacaoMin(d.itensPorCotacao, d.lojas);

  const section = (t: string, y: number) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...NAVY);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(220); doc.line(M, y + 5, W - M, y + 5);
  };

  // Cabeçalho
  let y = 38;
  if (logo) { try { doc.addImage(logo, "PNG", M, y, 110, 34, undefined, "FAST"); } catch { /* ignore */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
  doc.text("PROPOSTA COMERCIAL", W - M, y + 12, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text(`Nº ${numeroProposta(hoje)}  ·  Emitida em ${dataBR(hoje)}`, W - M, y + 26, { align: "right" });
  doc.text(`Válida até ${dataBR(validade)}`, W - M, y + 38, { align: "right" });
  doc.setDrawColor(...NAVY); doc.setLineWidth(1.5); doc.line(M, y + 50, W - M, y + 50); doc.setLineWidth(0.5);

  // Destinatário
  y += 74;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAY);
  doc.text("PREPARADO PARA", M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20);
  doc.text(d.rede || "Supermercado", M, y + 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
  const sub = [d.decisor && `A/C ${d.decisor}`, d.cidade, `${d.lojas} ${d.lojas === 1 ? "loja" : "lojas"}`].filter(Boolean).join("  ·  ");
  doc.text(sub, M, y + 33);

  // Inclusos
  y += 62;
  section("1. O que está incluso", y);
  y += 22;
  doc.setFontSize(10); doc.setTextColor(40); doc.setFont("helvetica", "normal");
  INCLUSOS.forEach((t) => {
    doc.setFillColor(...GREEN); doc.circle(M + 4, y - 3.5, 2.6, "F");
    doc.text(t, M + 14, y);
    y += 16;
  });

  // Impacto
  y += 12;
  section("2. Impacto operacional estimado", y);
  y += 16;
  const bw = (W - 2 * M - 20) / 3;
  const kpis: [string, string][] = [
    [`~${horas} h`, "economizadas por mês"],
    [`${depois} min`, `por cotação (antes ${(Math.round(antes / 6) / 10).toLocaleString("pt-BR")} h)`],
    [`${d.itensPorCotacao} itens`, `${d.cotacoesPorSemana}x por semana`],
  ];
  kpis.forEach(([v, l], i) => {
    const x = M + i * (bw + 10);
    doc.setFillColor(244, 246, 250); doc.roundedRect(x, y, bw, 52, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
    doc.text(v, x + bw / 2, y + 22, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAY);
    doc.text(l, x + bw / 2, y + 38, { align: "center" });
  });
  y += 64;
  doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Estimativa baseada no volume informado. Inclui menor preço por item e redução de rupturas.", M, y);

  // Investimento
  y += 22;
  section("3. Investimento e condições", y);
  y += 16;
  const cw = (W - 2 * M - 14) / 2;
  const ch = 132;
  // Anual
  doc.setFillColor(236, 248, 241); doc.setDrawColor(...GREEN); doc.setLineWidth(1.4);
  doc.roundedRect(M, y, cw, ch, 8, 8, "FD"); doc.setLineWidth(0.5);
  doc.setFillColor(...GREEN); doc.roundedRect(M + 12, y + 10, 92, 15, 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255);
  doc.text("RECOMENDADO", M + 58, y + 20.5, { align: "center" });
  doc.setFontSize(11); doc.setTextColor(20); doc.text("Plano Anual à vista", M + 12, y + 44);
  doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text(brl(d.anual), M + 12, y + 72);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
  doc.text(`ou 12x de ${brl(d.anual / 12)}`, M + 12, y + 88);
  doc.text("Implantação e treinamento GRÁTIS", M + 12, y + 104);
  if (eco > 0) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
    doc.text(`Economia de ${brl(eco)} no 1º ano`, M + 12, y + 120);
  }
  // Mensal
  const x2 = M + cw + 14;
  doc.setFillColor(250, 250, 252); doc.setDrawColor(210);
  doc.roundedRect(x2, y, cw, ch, 8, 8, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
  doc.text("Plano Mensal", x2 + 12, y + 44);
  doc.setFontSize(22); doc.setTextColor(...NAVY); doc.text(`${brl(d.mensal)}`, x2 + 12, y + 72);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
  doc.text("por mês", x2 + 12, y + 88);
  doc.text(d.implantacao > 0 ? `+ ${brl(d.implantacao)} de implantação` : "Sem taxa de implantação", x2 + 12, y + 104);
  doc.text(`Total 12 meses: ${brl(d.mensal * 12 + d.implantacao)}`, x2 + 12, y + 120);

  // Próximos passos
  y += ch + 26;
  section("4. Próximos passos", y);
  y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
  [
    "Aceite da proposta e pagamento (Pix ou link de pagamento)",
    "Importação dos produtos e cadastro dos fornecedores em até 48 horas",
    "Treinamento da equipe e primeira cotação acompanhada",
  ].forEach((t, i) => {
    doc.setFillColor(...NAVY); doc.circle(M + 7, y - 3.5, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255);
    doc.text(String(i + 1), M + 7, y - 0.8, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
    doc.text(t, M + 22, y);
    y += 20;
  });

  // Rodapé
  const fy = H - 92;
  doc.setFillColor(...NAVY); doc.roundedRect(M, fy, W - 2 * M, 54, 8, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255);
  doc.text(`Proposta válida por ${d.validadeDias} dias (até ${dataBR(validade)})`, M + 14, fy + 21);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const linha = [d.pix && `Chave Pix: ${d.pix}`, d.contato && `Dúvidas: WhatsApp ${d.contato}`].filter(Boolean).join("   ·   ");
  doc.text(linha || "Compra360 — Tecnologia em compras para o varejo", M + 14, fy + 38);
  doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  doc.text("Compra360 · compra360app.com.br", W / 2, H - 22, { align: "center" });

  return doc;
}

export async function baixarPropostaPdf(d: PropostaDados) {
  const logo = await loadLogo();
  const doc = buildPropostaPdf(d, logo);
  const nome = (d.rede || "proposta").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  doc.save(`Proposta_Compra360_${nome}.pdf`);
}
