/**
 * Multi-scenario purchase optimization engine.
 * Generates 2-3 scenarios for the buyer to compare and choose.
 */

export interface ScenarioItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  fator: number;
  preco: number;
  total: number;
  cpId: string;
  fornecedorId: string;
}

export interface ScenarioSupplier {
  fornecedorId: string;
  fornecedorNome: string;
  items: ScenarioItem[];
  total: number;
  minimoOk: boolean;
  pedidoMinimo: number;
}

export interface Scenario {
  id: string;
  nome: string;
  descricao: string;
  icon: string;
  totalGeral: number;
  diffVsBaseline: number; // positive = more expensive, negative = cheaper
  fornecedores: ScenarioSupplier[];
  semPreco: number;
  numFornecedores: number;
}

interface ProductPrice {
  cpId: string;
  fornecedorId: string;
  preco: number;
}

interface FornecedorInfo {
  id: string;
  nome: string;
  pedido_minimo: number;
}

interface CpInfo {
  id: string;
  produtoNome: string;
  embalagem: string;
  quantidade: number;
  fator: number;
}

/**
 * Build all available prices per product, sorted by price ascending
 */
function buildPriceMap(
  cotacaoProdutos: CpInfo[],
  precos: { cotacao_produto_id: string; fornecedor_id: string; preco: number | null }[]
): Record<string, ProductPrice[]> {
  const map: Record<string, ProductPrice[]> = {};
  for (const cp of cotacaoProdutos) {
    const cpPrecos = precos
      .filter((p) => p.cotacao_produto_id === cp.id && p.preco !== null && Number(p.preco) > 0)
      .map((p) => ({ cpId: cp.id, fornecedorId: p.fornecedor_id, preco: Number(p.preco) }))
      .sort((a, b) => a.preco - b.preco);
    if (cpPrecos.length > 0) map[cp.id] = cpPrecos;
  }
  return map;
}

function buildSupplierResult(
  assignments: Record<string, { fornecedorId: string; preco: number }>,
  cotacaoProdutos: CpInfo[],
  fornecedorMap: Record<string, FornecedorInfo>
): { suppliers: ScenarioSupplier[]; total: number; semPreco: number } {
  const buckets: Record<string, ScenarioItem[]> = {};
  let semPreco = 0;

  for (const cp of cotacaoProdutos) {
    const assignment = assignments[cp.id];
    if (!assignment) { semPreco++; continue; }
    const { fornecedorId, preco } = assignment;
    if (!buckets[fornecedorId]) buckets[fornecedorId] = [];
    buckets[fornecedorId].push({
      produto: cp.produtoNome,
      embalagem: cp.embalagem,
      quantidade: cp.quantidade,
      fator: cp.fator,
      preco,
      total: preco * cp.quantidade * cp.fator,
      cpId: cp.id,
      fornecedorId,
    });
  }

  let totalGeral = 0;
  const suppliers: ScenarioSupplier[] = Object.entries(buckets)
    .map(([fId, items]) => {
      const total = items.reduce((s, i) => s + i.total, 0);
      totalGeral += total;
      const f = fornecedorMap[fId];
      const minimo = f?.pedido_minimo || 0;
      return {
        fornecedorId: fId,
        fornecedorNome: f?.nome || "?",
        items,
        total,
        minimoOk: minimo <= 0 || total >= minimo,
        pedidoMinimo: minimo,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { suppliers, total: totalGeral, semPreco };
}

/**
 * Scenario 1: Pure cheapest price per item (baseline)
 */
function scenarioMelhorPreco(
  cotacaoProdutos: CpInfo[],
  priceMap: Record<string, ProductPrice[]>,
  fornecedorMap: Record<string, FornecedorInfo>
): Scenario {
  const assignments: Record<string, { fornecedorId: string; preco: number }> = {};
  for (const cp of cotacaoProdutos) {
    const prices = priceMap[cp.id];
    if (prices && prices.length > 0) {
      assignments[cp.id] = { fornecedorId: prices[0].fornecedorId, preco: prices[0].preco };
    }
  }
  const { suppliers, total, semPreco } = buildSupplierResult(assignments, cotacaoProdutos, fornecedorMap);
  const belowMin = suppliers.filter((s) => !s.minimoOk);

  return {
    id: "melhor-preco",
    nome: "Melhor preço",
    descricao: belowMin.length > 0
      ? `Menor preço por item. ${belowMin.length} fornecedor(es) abaixo do pedido mínimo.`
      : "Menor preço por item. Todos os fornecedores atendem o pedido mínimo.",
    icon: "💰",
    totalGeral: total,
    diffVsBaseline: 0,
    fornecedores: suppliers,
    semPreco,
    numFornecedores: suppliers.length,
  };
}

/**
 * Scenario 2: Drop suppliers below minimum, redistribute to next cheapest
 */
function scenarioSemMinimoAbaixo(
  cotacaoProdutos: CpInfo[],
  priceMap: Record<string, ProductPrice[]>,
  fornecedorMap: Record<string, FornecedorInfo>,
  baselineTotal: number
): Scenario | null {
  const assignments: Record<string, { fornecedorId: string; preco: number }> = {};
  for (const cp of cotacaoProdutos) {
    const prices = priceMap[cp.id];
    if (prices && prices.length > 0) {
      assignments[cp.id] = { fornecedorId: prices[0].fornecedorId, preco: prices[0].preco };
    }
  }

  const droppedSuppliers = new Set<string>();
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    const totals: Record<string, number> = {};
    for (const [cpId, a] of Object.entries(assignments)) {
      const cp = cotacaoProdutos.find((c) => c.id === cpId);
      if (!cp) continue;
      totals[a.fornecedorId] = (totals[a.fornecedorId] || 0) + a.preco * cp.quantidade * cp.fator;
    }

    for (const [fId, total] of Object.entries(totals)) {
      const f = fornecedorMap[fId];
      const minimo = f?.pedido_minimo || 0;
      if (minimo <= 0 || total >= minimo) continue;

      droppedSuppliers.add(fId);
      changed = true;
      for (const [cpId, a] of Object.entries(assignments)) {
        if (a.fornecedorId !== fId) continue;
        const prices = priceMap[cpId];
        if (!prices) continue;
        const next = prices.find((p) => !droppedSuppliers.has(p.fornecedorId));
        if (next) {
          assignments[cpId] = { fornecedorId: next.fornecedorId, preco: next.preco };
        }
      }
      break;
    }
  }

  const { suppliers, total, semPreco } = buildSupplierResult(assignments, cotacaoProdutos, fornecedorMap);
  const diff = total - baselineTotal;

  if (droppedSuppliers.size === 0) return null;

  return {
    id: "sem-minimo-abaixo",
    nome: "Pedidos mínimos OK",
    descricao: `Remove ${droppedSuppliers.size} fornecedor(es) que não atingem o mínimo. Itens redistribuídos para o próximo menor preço.`,
    icon: "✅",
    totalGeral: total,
    diffVsBaseline: diff,
    fornecedores: suppliers,
    semPreco,
    numFornecedores: suppliers.length,
  };
}

/**
 * Scenario 3: Consolidate — merge suppliers with few items into others 
 * when price difference is small (< threshold %)
 */
function scenarioConsolidado(
  cotacaoProdutos: CpInfo[],
  priceMap: Record<string, ProductPrice[]>,
  fornecedorMap: Record<string, FornecedorInfo>,
  baselineTotal: number,
  threshold: number = 0.05 // 5%
): Scenario | null {
  const assignments: Record<string, { fornecedorId: string; preco: number }> = {};
  for (const cp of cotacaoProdutos) {
    const prices = priceMap[cp.id];
    if (prices && prices.length > 0) {
      assignments[cp.id] = { fornecedorId: prices[0].fornecedorId, preco: prices[0].preco };
    }
  }

  const droppedSuppliers = new Set<string>();
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    const supplierItems: Record<string, string[]> = {};
    for (const [cpId, a] of Object.entries(assignments)) {
      if (!supplierItems[a.fornecedorId]) supplierItems[a.fornecedorId] = [];
      supplierItems[a.fornecedorId].push(cpId);
    }

    for (const [fId, cpIds] of Object.entries(supplierItems)) {
      if (cpIds.length > 2) continue;
      
      let canConsolidate = true;
      const moves: { cpId: string; newFId: string; newPreco: number; oldPreco: number }[] = [];
      
      for (const cpId of cpIds) {
        const prices = priceMap[cpId];
        if (!prices) { canConsolidate = false; break; }
        const current = assignments[cpId];
        const alternatives = prices.filter((p) => p.fornecedorId !== fId && !droppedSuppliers.has(p.fornecedorId));
        if (alternatives.length === 0) { canConsolidate = false; break; }
        const best = alternatives[0];
        const priceDiffPct = (best.preco - current.preco) / current.preco;
        if (priceDiffPct > threshold) { canConsolidate = false; break; }
        moves.push({ cpId, newFId: best.fornecedorId, newPreco: best.preco, oldPreco: current.preco });
      }

      if (canConsolidate && moves.length > 0) {
        for (const m of moves) {
          assignments[m.cpId] = { fornecedorId: m.newFId, preco: m.newPreco };
        }
        droppedSuppliers.add(fId);
        changed = true;
        break;
      }
    }
  }

  if (droppedSuppliers.size === 0) return null;

  changed = true;
  iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;
    const totals: Record<string, number> = {};
    for (const [cpId, a] of Object.entries(assignments)) {
      const cp = cotacaoProdutos.find((c) => c.id === cpId);
      if (!cp) continue;
      totals[a.fornecedorId] = (totals[a.fornecedorId] || 0) + a.preco * cp.quantidade * cp.fator;
    }
    for (const [fId, total] of Object.entries(totals)) {
      const f = fornecedorMap[fId];
      const minimo = f?.pedido_minimo || 0;
      if (minimo <= 0 || total >= minimo) continue;
      droppedSuppliers.add(fId);
      changed = true;
      for (const [cpId, a] of Object.entries(assignments)) {
        if (a.fornecedorId !== fId) continue;
        const prices = priceMap[cpId];
        if (!prices) continue;
        const next = prices.find((p) => !droppedSuppliers.has(p.fornecedorId));
        if (next) assignments[cpId] = { fornecedorId: next.fornecedorId, preco: next.preco };
      }
      break;
    }
  }

  const { suppliers, total, semPreco } = buildSupplierResult(assignments, cotacaoProdutos, fornecedorMap);
  const diff = total - baselineTotal;

  return {
    id: "consolidado",
    nome: "Consolidado",
    descricao: `Menos fornecedores: agrupa itens com preço próximo (até ${Math.round(threshold * 100)}% de diferença). Simplifica a logística.`,
    icon: "📦",
    totalGeral: total,
    diffVsBaseline: diff,
    fornecedores: suppliers,
    semPreco,
    numFornecedores: suppliers.length,
  };
}

/**
 * Main entry: generate all scenarios
 */
export function generateScenarios(
  cotacaoProdutos: { id: string; produtos?: { nome?: string; embalagem?: string } | null; quantidade?: number | null }[],
  precos: { cotacao_produto_id: string; fornecedor_id: string; preco: number | null }[],
  fornecedores: { id: string; nome: string; pedido_minimo?: number | null }[]
): Scenario[] {
  const cpInfos: CpInfo[] = cotacaoProdutos.map((cp) => ({
    id: cp.id,
    produtoNome: (cp as any).produtos?.nome || (cp as any).produto?.nome || "?",
    embalagem: (cp as any).produtos?.embalagem || (cp as any).produto?.embalagem || "",
    quantidade: cp.quantidade || 1,
    fator: (cp as any).fator_embalagem || 1,
  }));

  const fornecedorMap: Record<string, FornecedorInfo> = {};
  for (const f of fornecedores) {
    fornecedorMap[f.id] = { id: f.id, nome: f.nome, pedido_minimo: Number(f.pedido_minimo || 0) };
  }

  const priceMap = buildPriceMap(cpInfos, precos);

  // Generate all three raw scenarios
  const melhorPreco = scenarioMelhorPreco(cpInfos, priceMap, fornecedorMap);
  const economiaInteligente = scenarioSemMinimoAbaixo(cpInfos, priceMap, fornecedorMap, melhorPreco.totalGeral);
  const consolidado = scenarioConsolidado(cpInfos, priceMap, fornecedorMap, melhorPreco.totalGeral);

  // Use economia inteligente as reference, fallback to melhor preço
  const economia = economiaInteligente || melhorPreco;

  let candidates: Scenario[] = [melhorPreco];
  if (economiaInteligente) candidates.push(economiaInteligente);
  if (consolidado) candidates.push(consolidado);

  // 1. Remove dominated scenarios (strictly worse in both total AND supplier count)
  // NEVER remove "sem-minimo-abaixo" — it solves minimum order issues which is a distinct value
  candidates = candidates.filter(s1 =>
    s1.id === "sem-minimo-abaixo" ||
    !candidates.some(s2 =>
      s2 !== s1 &&
      s2.totalGeral <= s1.totalGeral &&
      s2.numFornecedores <= s1.numFornecedores &&
      (s2.totalGeral < s1.totalGeral || s2.numFornecedores < s1.numFornecedores)
    )
  );

  // 2. Tolerance rule for "menos fornecedores": remove if same/more suppliers or >5% more expensive
  if (consolidado && candidates.includes(consolidado)) {
    const aumento = (consolidado.totalGeral - economia.totalGeral) / economia.totalGeral;
    if (
      consolidado.numFornecedores >= economia.numFornecedores ||
      aumento > 0.05
    ) {
      candidates = candidates.filter(s => s !== consolidado);
    }
  }

  // 3. Mark economia inteligente as recommended (always first if present)
  const result: Scenario[] = [];
  const rec = candidates.find(s => s.id === "sem-minimo-abaixo");
  if (rec) result.push(rec);
  for (const s of candidates) {
    if (s.id !== "sem-minimo-abaixo") result.push(s);
  }

  return result;
}
