import { describe, it, expect } from "vitest";
import {
  buildSnapshotInsert,
  dedupHibridos,
  getCotacaoEmbalagem,
  getCotacaoFator,
  getCotacaoNome,
  isCatalogo,
  isCotacaoCatalogo,
  isProdutoLocked,
  type ProdutoHibrido,
} from "@/lib/buscaProdutos";

const catalogo = (over: Partial<ProdutoHibrido> = {}): ProdutoHibrido => ({
  fonte: "catalogo",
  id: "cat-1",
  nome: "Coca Cola 2L",
  ean: "7894900011517",
  embalagem: "FD",
  fator_embalagem: 6,
  ...over,
});

const local = (over: Partial<ProdutoHibrido> = {}): ProdutoHibrido => ({
  fonte: "local",
  id: "loc-1",
  nome: "Coca Cola 2L",
  ean: null,
  embalagem: "CX",
  fator_embalagem: 12,
  ...over,
});

describe("buscaProdutos — dedup com preferência do catálogo", () => {
  it("mantém o catálogo e remove o local com mesmo nome (case-insensitive)", () => {
    const rows = [catalogo(), local({ nome: "coca cola 2l" })];
    const res = dedupHibridos(rows);
    expect(res).toHaveLength(1);
    expect(res[0].fonte).toBe("catalogo");
  });

  it("ordena catálogo antes de locais e preserva locais distintos", () => {
    const rows = [
      local({ id: "loc-2", nome: "Pão Francês" }),
      catalogo(),
      local({ id: "loc-3", nome: "Outro" }),
    ];
    const res = dedupHibridos(rows);
    expect(res.map((r) => r.fonte)).toEqual(["catalogo", "local", "local"]);
  });

  it("isCatalogo / isProdutoLocked refletem a fonte", () => {
    expect(isCatalogo(catalogo())).toBe(true);
    expect(isCatalogo(local())).toBe(false);
    expect(isProdutoLocked(catalogo())).toBe(true);
    expect(isProdutoLocked(local())).toBe(false);
  });
});

describe("buscaProdutos — buildSnapshotInsert", () => {
  const cotacaoId = "cot-1";

  it("catálogo: copia nome/ean/embalagem/fator e ignora overrides", () => {
    const snap = buildSnapshotInsert({
      cotacaoId,
      produto: catalogo(),
      quantidade: 3,
      embalagem: "KG", // deve ser ignorado
      fator: 99,
    });
    expect(snap).toMatchObject({
      cotacao_id: cotacaoId,
      catalogo_mestre_id: "cat-1",
      produto_id: null,
      nome: "Coca Cola 2L",
      ean: "7894900011517",
      tipo_embalagem: "FD",
      fator_embalagem: 6,
      quantidade: 3,
    });
  });

  it("catálogo sem fator válido cai para o padrão da embalagem", () => {
    const snap = buildSnapshotInsert({
      cotacaoId,
      produto: catalogo({ fator_embalagem: 0 }),
      quantidade: 1,
    });
    expect(snap.fator_embalagem).toBeGreaterThan(0);
  });

  it("local: respeita override do usuário", () => {
    const snap = buildSnapshotInsert({
      cotacaoId,
      produto: local(),
      quantidade: 2,
      embalagem: "UNI",
      fator: 1,
    });
    expect(snap).toMatchObject({
      cotacao_id: cotacaoId,
      catalogo_mestre_id: null,
      produto_id: "loc-1",
      nome: "Coca Cola 2L",
      ean: null,
      tipo_embalagem: "UNI",
      fator_embalagem: 1,
      quantidade: 2,
    });
  });

  it("local sem override usa o cadastro do produto", () => {
    const snap = buildSnapshotInsert({
      cotacaoId,
      produto: local(),
      quantidade: 1,
    });
    expect(snap.tipo_embalagem).toBe("CX");
    expect(snap.fator_embalagem).toBe(12);
  });

  it("local sem cadastro nem override cai para o padrão da embalagem UNI", () => {
    const snap = buildSnapshotInsert({
      cotacaoId,
      produto: local({ embalagem: null, fator_embalagem: null }),
      quantidade: 1,
    });
    expect(snap.tipo_embalagem).toBe("UNI");
    expect(snap.fator_embalagem).toBeGreaterThan(0);
  });
});

describe("buscaProdutos — getters preferem snapshot", () => {
  it("usa cotacao_produtos.nome quando presente", () => {
    expect(
      getCotacaoNome({ nome: "SNAP", produtos: { nome: "old" } }),
    ).toBe("SNAP");
  });

  it("faz fallback para join produtos.nome", () => {
    expect(getCotacaoNome({ nome: null, produtos: { nome: "fallback" } })).toBe("fallback");
  });

  it("faz fallback para relação singular produto.nome (CotacaoPage)", () => {
    expect(getCotacaoNome({ nome: null, produto: { nome: "singular" } } as any)).toBe("singular");
    expect(getCotacaoEmbalagem({ tipo_embalagem: null, produto: { embalagem: "PCT" } } as any)).toBe("PCT");
  });

  it("embalagem/fator do snapshot têm prioridade", () => {
    const cp = {
      tipo_embalagem: "FD",
      fator_embalagem: 6,
      produtos: { embalagem: "CX", fator_embalagem: 12 },
    };
    expect(getCotacaoEmbalagem(cp)).toBe("FD");
    expect(getCotacaoFator(cp)).toBe(6);
  });

  it("isCotacaoCatalogo detecta itens do catálogo", () => {
    expect(isCotacaoCatalogo({ catalogo_mestre_id: "x" })).toBe(true);
    expect(isCotacaoCatalogo({ catalogo_mestre_id: null })).toBe(false);
  });
});
