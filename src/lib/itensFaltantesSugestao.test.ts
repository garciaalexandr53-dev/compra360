import { describe, it, expect } from "vitest";
import {
  detectarSugestaoEquipe,
  buildCotacaoProdutoInsertFromItem,
  type ItemFaltanteRow,
} from "@/lib/itensFaltantesImport";

const padraoCatalogo = { embalagem: "CX", fator_embalagem: 24 };

const itemBase: ItemFaltanteRow = {
  id: "i1",
  nome: "Refrigerante 2L",
  quantidade: 3,
  ean: "7891234567895",
  catalogo_mestre_id: "cm-1",
  embalagem: "CX",
  fator_embalagem: 24,
  observacao: null,
};

describe("detectarSugestaoEquipe", () => {
  it("marca divergência quando o funcionário ajustou o fator", () => {
    const s = detectarSugestaoEquipe({ ...itemBase, fator_embalagem: 12 }, padraoCatalogo);
    expect(s?.divergente).toBe(true);
    expect(s?.sugerido).toEqual({ embalagem: "CX", fator: 12 });
    expect(s?.padrao).toEqual({ embalagem: "CX", fator: 24 });
  });

  it("marca divergência quando o funcionário ajustou a embalagem", () => {
    const s = detectarSugestaoEquipe(
      { ...itemBase, embalagem: "fd", fator_embalagem: 24 },
      padraoCatalogo,
    );
    expect(s?.divergente).toBe(true);
    expect(s?.sugerido.embalagem).toBe("FD");
  });

  it("não marca divergência quando igual ao padrão (case/espaços tolerados)", () => {
    const s = detectarSugestaoEquipe({ ...itemBase, embalagem: " cx " }, padraoCatalogo);
    expect(s?.divergente).toBe(false);
  });

  it("retorna null sem padrão conhecido", () => {
    expect(detectarSugestaoEquipe(itemBase, null)).toBeNull();
  });
});

describe("importação usa o valor confirmado pelo comprador", () => {
  it("grava no snapshot o fator ajustado pelo funcionário (aceito)", () => {
    const insert = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c1",
      item: { ...itemBase, fator_embalagem: 12 },
    });
    expect(insert).toMatchObject({
      cotacao_id: "c1",
      nome: "Refrigerante 2L",
      catalogo_mestre_id: "cm-1",
      tipo_embalagem: "CX",
      fator_embalagem: 12,
      produto_id: null,
    });
  });

  it("grava o padrão quando o comprador voltou o item ao padrão do catálogo", () => {
    // "Voltar ao padrão" reescreve as colunas do item antes da importação
    const itemRevertido = {
      ...itemBase,
      embalagem: padraoCatalogo.embalagem,
      fator_embalagem: padraoCatalogo.fator_embalagem,
    };
    const insert = buildCotacaoProdutoInsertFromItem({
      cotacaoId: "c1",
      item: itemRevertido,
    });
    expect(insert).toMatchObject({ tipo_embalagem: "CX", fator_embalagem: 24 });
  });
});
