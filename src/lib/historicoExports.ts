import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatBRL, formatDateTime } from "@/lib/format";
import { withAssetVersion } from "@/lib/assetVersion";

export interface ExportRow {
  nome: string;
  embalagem: string;
  fator: number;
  qtd: number;
  fornecedor: string;
  precoUnit: number | null;
  total: number | null;
  allPrecos: Array<{ id: string; preco: number; fornecedores?: { nome?: string } | null }>;
}

export interface ExportPedidoForn {
  fornecedor: string;
  itens: ExportRow[];
  total: number;
}

export interface ExportCotacaoMeta {
  nome: string;
  created_at: string;
  finalizada_at?: string | null;
  status: string;
  loja_nome?: string | null;
  total_pedido: number;
  produtos_count: number;
  fornecedores_count: number;
}

const LOGO_URL = withAssetVersion("https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada//logo-completa.png");

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeFile(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
}

/* ============== EXCEL ============== */
export function exportCotacaoToExcel(
  meta: ExportCotacaoMeta,
  rows: ExportRow[],
  pedidos: ExportPedidoForn[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo
  const resumoData = [
    ["Compra360 — Relatório de Cotação"],
    [],
    ["Cotação", meta.nome],
    ["Criada em", formatDateTime(meta.created_at)],
    ["Finalizada em", meta.finalizada_at ? formatDateTime(meta.finalizada_at) : "—"],
    ["Status", meta.status],
    ["Unidade", meta.loja_nome || "—"],
    ["Produtos", meta.produtos_count],
    ["Fornecedores que responderam", meta.fornecedores_count],
    ["Total do pedido", meta.total_pedido],
    [],
    ["Produto", "Embalagem", "Fator", "Qtd", "Fornecedor escolhido", "Preço un.", "Total"],
    ...rows.map((r) => [
      r.nome,
      r.embalagem,
      r.fator,
      r.qtd,
      r.fornecedor,
      r.precoUnit ?? "—",
      r.total ?? "—",
    ]),
    [],
    ["", "", "", "", "", "TOTAL GERAL", rows.reduce((a, r) => a + (r.total || 0), 0)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Sheet 2: Pedidos por fornecedor
  if (pedidos.length) {
    const data: any[][] = [["Fornecedor", "Produto", "Embalagem", "Qtd", "Preço un.", "Total"]];
    for (const g of pedidos) {
      for (const it of g.itens) {
        data.push([g.fornecedor, it.nome, it.embalagem, it.qtd, it.precoUnit ?? "—", it.total ?? "—"]);
      }
      data.push(["", "", "", "", `Subtotal ${g.fornecedor}`, g.total]);
      data.push([]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 24 }, { wch: 36 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos por fornecedor");
  }

  // Sheet 3: Todos os preços
  const precosData: any[][] = [["Produto", "Fornecedor", "Preço", "Vencedor?"]];
  for (const r of rows) {
    if (!r.allPrecos.length) {
      precosData.push([r.nome, "—", "—", ""]);
      continue;
    }
    r.allPrecos.forEach((p, idx) => {
      precosData.push([r.nome, p.fornecedores?.nome || "—", Number(p.preco), idx === 0 ? "Sim" : ""]);
    });
  }
  const wsPrecos = XLSX.utils.aoa_to_sheet(precosData);
  wsPrecos["!cols"] = [{ wch: 36 }, { wch: 28 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPrecos, "Todos os preços");

  XLSX.writeFile(wb, `${safeFile(meta.nome)}_compra360.xlsx`);
}

/* ============== PDF ============== */
export async function exportCotacaoToPdf(
  meta: ExportCotacaoMeta,
  rows: ExportRow[],
  pedidos: ExportPedidoForn[]
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogoDataUrl();

  // Header
  let y = 36;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 36, y, 90, 28, undefined, "FAST");
    } catch {
      // ignore
    }
  }
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Cotação", pageW - 36, y + 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, pageW - 36, y + 28, { align: "right" });
  doc.setTextColor(0);

  y += 56;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(meta.nome, 36, y);
  y += 14;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  const lineA = [
    `Criada em: ${formatDateTime(meta.created_at)}`,
    meta.finalizada_at ? `Finalizada em: ${formatDateTime(meta.finalizada_at)}` : null,
    `Status: ${meta.status}`,
    meta.loja_nome ? `Unidade: ${meta.loja_nome}` : null,
  ].filter(Boolean).join("  ·  ");
  const lineB = [
    `Produtos: ${meta.produtos_count}`,
    `Fornecedores: ${meta.fornecedores_count}`,
    `Total: ${formatBRL(meta.total_pedido)}`,
  ].join("  ·  ");
  // Wrap defensively in case of very long unit names
  const wrappedA = doc.splitTextToSize(lineA, pageW - 72);
  const wrappedB = doc.splitTextToSize(lineB, pageW - 72);
  doc.text(wrappedA, 36, y);
  y += wrappedA.length * 11;
  doc.text(wrappedB, 36, y);
  y += wrappedB.length * 11 + 6;
  doc.setTextColor(0);

  // Main table
  autoTable(doc, {
    startY: y,
    head: [["Produto", "Embal.", "Fator", "Qtd", "Fornecedor", "Preço un.", "Total"]],
    body: rows.map((r) => [
      r.nome,
      r.embalagem,
      `×${r.fator}`,
      String(r.qtd),
      r.fornecedor,
      r.precoUnit != null ? formatBRL(r.precoUnit) : "—",
      r.total != null ? formatBRL(r.total) : "—",
    ]),
    foot: [["", "", "", "", "", "TOTAL GERAL", formatBRL(rows.reduce((a, r) => a + (r.total || 0), 0))]],
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [40, 50, 75], textColor: 255 },
    footStyles: { fillColor: [240, 240, 245], textColor: 20, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 160 },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: 36, right: 36 },
  });

  // Pedidos por fornecedor
  if (pedidos.length) {
    let cursor = (doc as any).lastAutoTable.finalY + 18;
    if (cursor > 720) {
      doc.addPage();
      cursor = 40;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Pedidos por fornecedor", 36, cursor);
    cursor += 8;

    for (const g of pedidos) {
      autoTable(doc, {
        startY: cursor + 6,
        head: [[g.fornecedor, "", "", formatBRL(g.total)]],
        body: g.itens.map((it) => [
          it.nome,
          `${it.qtd} × ${it.embalagem}`,
          it.precoUnit != null ? formatBRL(it.precoUnit) : "—",
          it.total != null ? formatBRL(it.total) : "—",
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5 },
        headStyles: { fillColor: [60, 80, 110], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 220 },
          2: { halign: "right" },
          3: { halign: "right" },
        },
        margin: { left: 36, right: 36 },
      });
      cursor = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Compra360 · ${meta.nome} · Página ${i}/${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" }
    );
  }

  doc.save(`${safeFile(meta.nome)}_compra360.pdf`);
}

/* ============== PRINT ============== */
export function printCotacao(
  meta: ExportCotacaoMeta,
  rows: ExportRow[],
  pedidos: ExportPedidoForn[]
) {
  const totalGeral = rows.reduce((a, r) => a + (r.total || 0), 0);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const rowsHtml = rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.nome)}</td>
      <td class="c">${escapeHtml(r.embalagem)}</td>
      <td class="c">×${r.fator}</td>
      <td class="c">${r.qtd}</td>
      <td>${escapeHtml(r.fornecedor)}</td>
      <td class="r mono">${r.precoUnit != null ? formatBRL(r.precoUnit) : "—"}</td>
      <td class="r mono b">${r.total != null ? formatBRL(r.total) : "—"}</td>
    </tr>`).join("");

  const pedidosHtml = pedidos.map((g) => `
    <div class="pf">
      <div class="pf-h"><span>${escapeHtml(g.fornecedor)}</span><span class="mono b">${formatBRL(g.total)}</span></div>
      <ul>${g.itens.map((it) => `<li><span>${escapeHtml(it.nome)} <small>(${it.qtd})</small></span><span class="mono">${formatBRL(it.total || 0)}</span></li>`).join("")}</ul>
    </div>`).join("");

  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${escapeHtml(meta.nome)} — Compra360</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:24px;font-size:12px}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #28324b;padding-bottom:10px;margin-bottom:14px}
  header img{height:34px}
  h1{font-size:18px;margin:0}
  .meta{color:#555;font-size:11px;margin-top:4px}
  h2{font-size:13px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#28324b}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#28324b;color:#fff;font-weight:600}
  .c{text-align:center}.r{text-align:right}.b{font-weight:700}.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
  tfoot td{background:#f0f0f5;font-weight:700}
  .pf{border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin:8px 0;page-break-inside:avoid}
  .pf-h{display:flex;justify-content:space-between;font-weight:700;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:4px}
  .pf ul{list-style:none;padding:0;margin:0}
  .pf li{display:flex;justify-content:space-between;padding:2px 0;color:#444}
  small{color:#888}
  @media print{body{margin:14mm}}
</style></head>
<body>
  <header>
    <div><img src="${LOGO_URL}" alt="Compra360"/></div>
    <div style="text-align:right">
      <h1>Relatório de Cotação</h1>
      <div class="meta">Gerado em ${formatDateTime(new Date().toISOString())}</div>
    </div>
  </header>
  <h1 style="font-size:15px;margin:0">${escapeHtml(meta.nome)}</h1>
  <div class="meta">
    Criada em: ${formatDateTime(meta.created_at)}${meta.finalizada_at ? ` · Finalizada em: ${formatDateTime(meta.finalizada_at)}` : ""} · Status: ${escapeHtml(meta.status)}
    ${meta.loja_nome ? ` · Unidade: ${escapeHtml(meta.loja_nome)}` : ""}
    · Produtos: ${meta.produtos_count} · Fornecedores: ${meta.fornecedores_count}
    · <b>Total: ${formatBRL(meta.total_pedido)}</b>
  </div>

  <h2>Resumo do pedido</h2>
  <table>
    <thead><tr>
      <th>Produto</th><th>Embal.</th><th>Fator</th><th>Qtd</th>
      <th>Fornecedor</th><th>Preço un.</th><th>Total</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="6" class="r">TOTAL GERAL</td><td class="r mono">${formatBRL(totalGeral)}</td></tr></tfoot>
  </table>

  ${pedidos.length ? `<h2>Pedidos por fornecedor</h2>${pedidosHtml}` : ""}

  <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/* ============== CONSOLIDATED EXPORT (multi-cotação) ============== */

export interface ConsolidatedCotacao {
  meta: ExportCotacaoMeta;
  rows: ExportRow[];
  pedidos: ExportPedidoForn[];
}

export interface ConsolidatedSummary {
  /** Display label, e.g. "Últimos 30 dias" or "12/04/2025 → 02/05/2025". */
  periodoLabel: string;
  /** Optional store filter label. */
  lojaLabel?: string | null;
  totalGeral: number;
  totalCotacoes: number;
  totalProdutos: number;
  totalFornecedores: number;
}

export function exportConsolidadoToExcel(
  summary: ConsolidatedSummary,
  cotacoes: ConsolidatedCotacao[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo geral
  const resumo: any[][] = [
    ["Compra360 — Relatório Consolidado de Cotações"],
    [],
    ["Período", summary.periodoLabel],
    ["Loja", summary.lojaLabel || "Todas"],
    ["Total de cotações", summary.totalCotacoes],
    ["Total de produtos (linhas)", summary.totalProdutos],
    ["Total de fornecedores únicos", summary.totalFornecedores],
    ["Valor total consolidado", summary.totalGeral],
    [],
    ["Cotação", "Data", "Status", "Loja", "Produtos", "Fornecedores", "Total"],
    ...cotacoes.map((c) => [
      c.meta.nome,
      formatDateTime(c.meta.created_at),
      c.meta.status,
      c.meta.loja_nome || "—",
      c.meta.produtos_count,
      c.meta.fornecedores_count,
      c.meta.total_pedido,
    ]),
    [],
    ["", "", "", "", "", "TOTAL CONSOLIDADO", summary.totalGeral],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 12 },
    { wch: 22 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Consolidado");

  // Sheet 2: Itens detalhados (todas cotações)
  const itens: any[][] = [
    ["Cotação", "Data", "Produto", "Embalagem", "Fator", "Qtd", "Fornecedor", "Preço un.", "Total"],
  ];
  for (const c of cotacoes) {
    for (const r of c.rows) {
      itens.push([
        c.meta.nome,
        formatDateTime(c.meta.created_at),
        r.nome,
        r.embalagem,
        r.fator,
        r.qtd,
        r.fornecedor,
        r.precoUnit ?? "—",
        r.total ?? "—",
      ]);
    }
  }
  const wsItens = XLSX.utils.aoa_to_sheet(itens);
  wsItens["!cols"] = [
    { wch: 28 }, { wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 6 },
    { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens Detalhados");

  // Sheet 3: Total por fornecedor (cross-cotação)
  const fornAgg = new Map<string, { total: number; itens: number; cots: Set<string> }>();
  for (const c of cotacoes) {
    for (const g of c.pedidos) {
      if (!fornAgg.has(g.fornecedor)) {
        fornAgg.set(g.fornecedor, { total: 0, itens: 0, cots: new Set() });
      }
      const e = fornAgg.get(g.fornecedor)!;
      e.total += g.total;
      e.itens += g.itens.length;
      e.cots.add(c.meta.nome);
    }
  }
  const fornData: any[][] = [["Fornecedor", "Cotações", "Itens vendidos", "Total ganho"]];
  Array.from(fornAgg.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([nome, e]) => {
      fornData.push([nome, e.cots.size, e.itens, e.total]);
    });
  const wsForn = XLSX.utils.aoa_to_sheet(fornData);
  wsForn["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsForn, "Por Fornecedor");

  XLSX.writeFile(
    wb,
    `consolidado_${summary.totalCotacoes}cotacoes_compra360.xlsx`
  );
}

export async function exportConsolidadoToPdf(
  summary: ConsolidatedSummary,
  cotacoes: ConsolidatedCotacao[]
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogoDataUrl();

  // Header
  let y = 36;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 36, y, 90, 28, undefined, "FAST");
    } catch {
      // ignore
    }
  }
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Consolidado", pageW - 36, y + 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, pageW - 36, y + 28, { align: "right" });
  doc.setTextColor(0);

  y += 56;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Período: ${summary.periodoLabel}`, 36, y);
  y += 14;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  const summaryA = `Loja: ${summary.lojaLabel || "Todas"}`;
  const summaryB = [
    `Cotações: ${summary.totalCotacoes}`,
    `Produtos: ${summary.totalProdutos}`,
    `Fornecedores: ${summary.totalFornecedores}`,
  ].join("  ·  ");
  const summaryC = `Total consolidado: ${formatBRL(summary.totalGeral)}`;
  doc.text(summaryA, 36, y);
  y += 11;
  doc.text(summaryB, 36, y);
  y += 11;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(summaryC, 36, y);
  y += 12;
  doc.setFont("helvetica", "normal");

  // Cotação summary table
  autoTable(doc, {
    startY: y,
    head: [["Cotação", "Data", "Status", "Loja", "Prod.", "Forn.", "Total"]],
    body: cotacoes.map((c) => [
      c.meta.nome,
      formatDateTime(c.meta.created_at),
      c.meta.status,
      c.meta.loja_nome || "—",
      String(c.meta.produtos_count),
      String(c.meta.fornecedores_count),
      formatBRL(c.meta.total_pedido),
    ]),
    foot: [["", "", "", "", "", "TOTAL", formatBRL(summary.totalGeral)]],
    styles: { fontSize: 8, cellPadding: 3.5 },
    headStyles: { fillColor: [40, 50, 75], textColor: 255 },
    footStyles: { fillColor: [240, 240, 245], textColor: 20, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 130 },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "right" },
    },
    margin: { left: 36, right: 36 },
  });

  // Por fornecedor (cross-cotação)
  const fornAgg = new Map<string, { total: number; itens: number; cots: Set<string> }>();
  for (const c of cotacoes) {
    for (const g of c.pedidos) {
      if (!fornAgg.has(g.fornecedor)) {
        fornAgg.set(g.fornecedor, { total: 0, itens: 0, cots: new Set() });
      }
      const e = fornAgg.get(g.fornecedor)!;
      e.total += g.total;
      e.itens += g.itens.length;
      e.cots.add(c.meta.nome);
    }
  }
  if (fornAgg.size > 0) {
    let cursor = (doc as any).lastAutoTable.finalY + 18;
    if (cursor > 700) {
      doc.addPage();
      cursor = 40;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Total por fornecedor", 36, cursor);
    cursor += 6;
    autoTable(doc, {
      startY: cursor + 4,
      head: [["Fornecedor", "Cotações", "Itens", "Total ganho"]],
      body: Array.from(fornAgg.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([nome, e]) => [nome, String(e.cots.size), String(e.itens), formatBRL(e.total)]),
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: [60, 80, 110], textColor: 255 },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right" },
      },
      margin: { left: 36, right: 36 },
    });
  }

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Compra360 · Consolidado · Página ${i}/${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" }
    );
  }

  doc.save(`consolidado_${summary.totalCotacoes}cotacoes_compra360.pdf`);
}

