/**
 * Multi-scenario purchase optimization engine.
 * Generates 2-3 scenarios for the buyer to compare and choose.
 */

export interface ItemAjuste {
  cpId: string;
  produto: string;
  embalagem: string;
  qtdOriginal: number;
  qtdSugerida: number;
  qtdExtra: number;
  preco: number;
  valorExtra: number;
  vantagemPct: number;
}

export interface GapAnalysis {
  fornecedorId: string;
  fornecedorNome: string;
  valorAtual: number;
  pedidoMinimo: number;
  gap: number;
  percentual: number;
  estrategia: "ajuste" | "negociar" | "remanejar";
  ajuste: {
    itens: ItemAjuste[];
    valorTotalAjustado: number;
    custoExtra: number;
    economiaVsAlternativa: number;
    viavel: boolean;
  } | null;
}

export interface ScenarioItem {
  produto: string;
  embalagem: string;
  quantidade: number;
  quantidadeOriginal?: number; // set when quantity was boosted to fill gap
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

export interface BoostDetail {
  fornecedorNome: string;
  itens: {
    produto: string;
    qtdOriginal: number;
    qtdNova: number;
    qtdExtra: number;
  }[];
}

export interface PullDetail {
  produto: string;
  fornecedorOrigem: string;
  fornecedorDestino: string;
}

export interface DiscardDetail {
  fornecedorNome: string;
}

export interface CascadeResult {
  fornecedoresIniciais: number;
  fornecedoresFinais: number;
  fornecedoresBoostados: number;
  itensPuxados: number;
  fornecedoresDescartados: number;
  boostDetails: BoostDetail[];
  pullDetails: PullDetail[];
  discardDetails: DiscardDetail[];
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
  cascadeResult?: CascadeResult;
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
  fornecedorMap: Record<string, FornecedorInfo>,
  qtyOverrides?: Record<string, number>
): { suppliers: ScenarioSupplier[]; total: number; semPreco: number } {
  const buckets: Record<string, ScenarioItem[]> = {};
  let semPreco = 0;

  for (const cp of cotacaoProdutos) {
    const assignment = assignments[cp.id];
    if (!assignment) { semPreco++; continue; }
    const { fornecedorId, preco } = assignment;
    if (!buckets[fornecedorId]) buckets[fornecedorId] = [];
    const qty = qtyOverrides?.[cp.id] ?? cp.quantidade;
    const boosted = qtyOverrides?.[cp.id] != null && qtyOverrides[cp.id] !== cp.quantidade;
    buckets[fornecedorId].push({
      produto: cp.produtoNome,
      embalagem: cp.embalagem,
      quantidade: qty,
      ...(boosted ? { quantidadeOriginal: cp.quantidade } : {}),
      fator: cp.fator,
      preco,
      total: preco * qty * cp.fator,
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
 * Scenario 2: Economia Inteligente — fill gap using 3 strategies in priority order:
 * 
 * 1. BOOST QUANTITY: Increase qty of items already assigned to the below-min supplier
 *    (cheapest items first). This keeps the best price and only adds what's needed.
 * 2. PULL ITEMS: Move items from other suppliers where cost increase is minimal.
 * 3. DISCARD: As last resort, move all items away from the supplier.
 */
function scenarioEconomiaInteligente(
  cotacaoProdutos: CpInfo[],
  priceMap: Record<string, ProductPrice[]>,
  fornecedorMap: Record<string, FornecedorInfo>,
  baselineTotal: number
): Scenario | null {
  // Start from best-price assignments, tracking quantity overrides
  const assignments: Record<string, { fornecedorId: string; preco: number }> = {};
  const qtyOverrides: Record<string, number> = {}; // cpId -> new quantity (when boosted)

  for (const cp of cotacaoProdutos) {
    const prices = priceMap[cp.id];
    if (prices && prices.length > 0) {
      assignments[cp.id] = { fornecedorId: prices[0].fornecedorId, preco: prices[0].preco };
    }
  }

  const getQty = (cpId: string): number => {
    const cp = cotacaoProdutos.find(c => c.id === cpId);
    return qtyOverrides[cpId] ?? cp?.quantidade ?? 1;
  };

  const getSupplierTotals = (): Record<string, number> => {
    const totals: Record<string, number> = {};
    for (const [cpId, a] of Object.entries(assignments)) {
      const cp = cotacaoProdutos.find(c => c.id === cpId);
      if (!cp) continue;
      const qty = getQty(cpId);
      totals[a.fornecedorId] = (totals[a.fornecedorId] || 0) + a.preco * qty * cp.fator;
    }
    return totals;
  };

  let madeChanges = false;
  let iterations = 0;
  let boostCount = 0;    // suppliers resolved via Boost
  let pullCount = 0;     // items effectively moved via Pull
  let discardCount = 0;  // suppliers discarded via Discard

  while (iterations < 30) {
    iterations++;
    const totals = getSupplierTotals();

    // Find suppliers below minimum
    const belowMin = Object.entries(totals)
      .filter(([fId, total]) => {
        const f = fornecedorMap[fId];
        const minimo = f?.pedido_minimo || 0;
        return minimo > 0 && total < minimo;
      })
      .sort((a, b) => {
        const gapA = (fornecedorMap[a[0]]?.pedido_minimo || 0) - a[1];
        const gapB = (fornecedorMap[b[0]]?.pedido_minimo || 0) - b[1];
        return gapA - gapB;
      });

    if (belowMin.length === 0) break;

    const [targetFId, currentTotal] = belowMin[0];
    const targetMinimo = fornecedorMap[targetFId]?.pedido_minimo || 0;
    let gap = targetMinimo - currentTotal;

    // === STRATEGY 1: Boost quantity of items already in this supplier ===
    // Find items assigned to target supplier, sorted by cheapest unit price
    const targetItems = Object.entries(assignments)
      .filter(([, a]) => a.fornecedorId === targetFId)
      .map(([cpId, a]) => {
        const cp = cotacaoProdutos.find(c => c.id === cpId)!;
        return { cpId, preco: a.preco, fator: cp.fator, unitCost: a.preco * cp.fator };
      })
      .sort((a, b) => a.unitCost - b.unitCost); // cheapest first

    for (const item of targetItems) {
      if (gap <= 0) break;
      // How many extra units needed to fill gap?
      const unitsNeeded = Math.ceil(gap / item.unitCost);
      // Cap at reasonable boost (max 50% increase or 5 units, whichever is more)
      const cp = cotacaoProdutos.find(c => c.id === item.cpId)!;
      const currentQty = getQty(item.cpId);
      const maxBoost = Math.max(Math.ceil(currentQty * 0.5), 5);
      const actualBoost = Math.min(unitsNeeded, maxBoost);

      if (actualBoost > 0) {
        qtyOverrides[item.cpId] = currentQty + actualBoost;
        gap -= actualBoost * item.unitCost;
        madeChanges = true;
      }
    }

    if (gap <= 0) {
      boostCount++;
      continue; // Successfully filled gap with quantity boosts
    }

    // === STRATEGY 2: Pull items from other suppliers ===
    type PullCandidate = {
      cpId: string;
      currentFId: string;
      currentPreco: number;
      targetPreco: number;
      costIncrease: number;
      itemTotal: number;
    };

    const candidates: PullCandidate[] = [];
    for (const [cpId, a] of Object.entries(assignments)) {
      if (a.fornecedorId === targetFId) continue;
      const cp = cotacaoProdutos.find(c => c.id === cpId);
      if (!cp) continue;

      const prices = priceMap[cpId];
      if (!prices) continue;
      const targetPrice = prices.find(p => p.fornecedorId === targetFId);
      if (!targetPrice) continue;

      const qty = getQty(cpId);
      const currentItemTotal = a.preco * qty * cp.fator;
      const newItemTotal = targetPrice.preco * qty * cp.fator;
      const costIncrease = newItemTotal - currentItemTotal;

      const sourceFId = a.fornecedorId;
      const sourceMinimo = fornecedorMap[sourceFId]?.pedido_minimo || 0;
      const sourceTotal = totals[sourceFId] || 0;
      const sourceAfterPull = sourceTotal - currentItemTotal;

      if (sourceMinimo > 0 && sourceTotal >= sourceMinimo && sourceAfterPull < sourceMinimo) {
        continue;
      }

      candidates.push({
        cpId,
        currentFId: sourceFId,
        currentPreco: a.preco,
        targetPreco: targetPrice.preco,
        costIncrease,
        itemTotal: newItemTotal,
      });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.costIncrease - b.costIncrease);
      let pulledAny = false;
      for (const c of candidates) {
        if (gap <= 0) break;
        assignments[c.cpId] = { fornecedorId: targetFId, preco: c.targetPreco };
        gap -= c.itemTotal;
        pulledAny = true;
        madeChanges = true;
        pullCount++;
      }
      if (pulledAny) continue;
    }

    // === STRATEGY 3: Discard supplier as last resort ===
    let discarded = false;
    for (const [cpId, a] of Object.entries(assignments)) {
      if (a.fornecedorId !== targetFId) continue;
      const prices = priceMap[cpId];
      if (!prices) continue;
      const next = prices.find(p => p.fornecedorId !== targetFId);
      if (next) {
        assignments[cpId] = { fornecedorId: next.fornecedorId, preco: next.preco };
        // Reset any qty boost for this item
        delete qtyOverrides[cpId];
        discarded = true;
        madeChanges = true;
      }
    }
    if (discarded) {
      discardCount++;
    }
    if (!discarded) break;
  }

  if (!madeChanges) return null;

  const { suppliers, total, semPreco } = buildSupplierResult(assignments, cotacaoProdutos, fornecedorMap, qtyOverrides);
  const diff = total - baselineTotal;
  const aindaAbaixo = suppliers.filter(s => !s.minimoOk);

  const acoes: string[] = [];
  if (boostCount > 0) acoes.push(`ajustou quantidades em ${boostCount} fornecedor(es)`);
  if (pullCount > 0) acoes.push(`redistribuiu ${pullCount} item(ns)`);
  if (discardCount > 0) acoes.push(`removeu ${discardCount} fornecedor(es)`);

  const descricao = aindaAbaixo.length > 0
    ? `${acoes.join(", ")} para atingir pedidos mínimos. ${aindaAbaixo.length} fornecedor(es) sem alternativa suficiente.`
    : acoes.length > 0
      ? `${acoes.join(", ")}. Todos os fornecedores atingem o pedido mínimo.`
      : "Todos os fornecedores já atingiam o pedido mínimo.";

  const fornecedoresIniciais = Object.keys(fornecedorMap).length;

  return {
    id: "sem-minimo-abaixo",
    nome: aindaAbaixo.length > 0 ? "Economia inteligente (parcial)" : "Economia inteligente",
    descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1),
    icon: aindaAbaixo.length > 0 ? "⚠️" : "✅",
    totalGeral: total,
    diffVsBaseline: diff,
    fornecedores: suppliers,
    semPreco,
    numFornecedores: suppliers.length,
    cascadeResult: {
      fornecedoresIniciais,
      fornecedoresFinais: suppliers.length,
      fornecedoresBoostados: boostCount,
      itensPuxados: pullCount,
      fornecedoresDescartados: discardCount,
    },
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

  // Post-consolidation: handle minimums
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
    nome: "Menos Fornecedores",
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
 * Analyzes suppliers below minimum and suggests resolution strategies.
 * - >= 85%: "ajuste" (smart boost)
 * - 60-84%: "negociar" (negotiate with supplier)
 * - < 60%: "remanejar" (defer to next quote)
 */
export function analyzeGaps(
  scenario: Scenario,
  cotacaoProdutos: { id: string; produtos?: { nome?: string; embalagem?: string } | null; quantidade?: number | null; fator_embalagem?: number | null }[],
  precos: { cotacao_produto_id: string; fornecedor_id: string; preco: number | null }[],
  fornecedores: { id: string; nome: string; pedido_minimo?: number | null; telefone?: string | null; representante?: string | null }[],
  maxBoostPct: number = 0.30
): GapAnalysis[] {
  const result: GapAnalysis[] = [];

  const cpInfos: CpInfo[] = cotacaoProdutos.map((cp) => ({
    id: cp.id,
    produtoNome: (cp as any).produtos?.nome || "?",
    embalagem: (cp as any).produtos?.embalagem || "",
    quantidade: cp.quantidade || 1,
    fator: (cp as any).fator_embalagem || 1,
  }));

  const priceMap = buildPriceMap(cpInfos, precos);
  const fornecedorMap: Record<string, (typeof fornecedores)[0]> = {};
  for (const f of fornecedores) fornecedorMap[f.id] = f;

  for (const sf of scenario.fornecedores) {
    if (sf.minimoOk) continue;

    const minimo = sf.pedidoMinimo;
    const gap = minimo - sf.total;
    const percentual = Math.round((sf.total / minimo) * 100);

    let estrategia: GapAnalysis["estrategia"] =
      percentual >= 85 ? "ajuste" :
      percentual >= 60 ? "negociar" : "remanejar";

    let ajuste: GapAnalysis["ajuste"] = null;

    if (estrategia === "ajuste") {
      const itensDoFornecedor = sf.items.map((item) => {
        const prices = priceMap[item.cpId] || [];
        const meuPreco = prices.find(p => p.fornecedorId === sf.fornecedorId)?.preco || item.preco;
        const segundoPreco = prices.find(p => p.fornecedorId !== sf.fornecedorId)?.preco;
        const vantagemPct = segundoPreco ? ((segundoPreco - meuPreco) / meuPreco) * 100 : 0;

        return {
          cpId: item.cpId,
          produto: item.produto,
          embalagem: item.embalagem,
          qtdOriginal: item.quantidade,
          preco: item.preco,
          vantagemPct: Math.max(0, vantagemPct),
          fator: item.fator,
        };
      }).sort((a, b) => b.vantagemPct - a.vantagemPct);

      const totalVantagem = itensDoFornecedor.reduce((s, i) => s + Math.max(i.vantagemPct, 0.1), 0);

      let valorColetado = 0;
      const itensAjustados: ItemAjuste[] = [];

      for (const item of itensDoFornecedor) {
        const peso = Math.max(item.vantagemPct, 0.1) / totalVantagem;
        const valorAlvo = gap * peso;
        const valorPorUnidade = item.preco * item.fator;
        const unidadesExtra = Math.ceil(valorAlvo / valorPorUnidade);
        const qtdSugerida = Math.min(
          item.qtdOriginal + unidadesExtra,
          Math.round(item.qtdOriginal * (1 + maxBoostPct))
        );
        const qtdExtra = qtdSugerida - item.qtdOriginal;
        const valorExtra = qtdExtra * valorPorUnidade;
        valorColetado += valorExtra;

        itensAjustados.push({
          cpId: item.cpId,
          produto: item.produto,
          embalagem: item.embalagem,
          qtdOriginal: item.qtdOriginal,
          qtdSugerida,
          qtdExtra,
          preco: item.preco,
          valorExtra,
          vantagemPct: item.vantagemPct,
        });
      }

      const valorTotalAjustado = sf.total + valorColetado;
      const viavel = valorTotalAjustado >= minimo;

      let custoAlternativa = 0;
      for (const item of sf.items) {
        const prices = priceMap[item.cpId] || [];
        const alternativa = prices.find(p => p.fornecedorId !== sf.fornecedorId);
        if (alternativa) {
          custoAlternativa += alternativa.preco * item.quantidade * item.fator;
        } else {
          custoAlternativa += item.total;
        }
      }

      const economiaVsAlternativa = custoAlternativa - (sf.total + valorColetado);

      if (!viavel) estrategia = "negociar";

      ajuste = {
        itens: itensAjustados,
        valorTotalAjustado,
        custoExtra: valorColetado,
        economiaVsAlternativa,
        viavel,
      };
    }

    result.push({
      fornecedorId: sf.fornecedorId,
      fornecedorNome: sf.fornecedorNome,
      valorAtual: sf.total,
      pedidoMinimo: minimo,
      gap,
      percentual,
      estrategia,
      ajuste,
    });
  }

  return result.sort((a, b) => b.percentual - a.percentual);
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
  const economia = scenarioEconomiaInteligente(cpInfos, priceMap, fornecedorMap, melhorPreco.totalGeral);
  const consolidado = scenarioConsolidado(cpInfos, priceMap, fornecedorMap, melhorPreco.totalGeral);

  // Use economia inteligente as reference, fallback to melhor preço
  const ref = economia || melhorPreco;

  let candidates: Scenario[] = [melhorPreco];
  if (economia) candidates.push(economia);
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
    const aumento = (consolidado.totalGeral - ref.totalGeral) / ref.totalGeral;
    if (
      consolidado.numFornecedores >= ref.numFornecedores ||
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
